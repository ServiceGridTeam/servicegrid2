import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExportRequest {
  payPeriodId: string;
  format: "csv" | "quickbooks_desktop" | "quickbooks_online" | "gusto" | "adp";
  options?: {
    includeRegular?: boolean;
    includeOvertime?: boolean;
    includeDoubleTime?: boolean;
    includeRates?: boolean;
  };
}

interface TimesheetData {
  user_id: string;
  user_first_name: string;
  user_last_name: string;
  user_email: string;
  regular_hours: number;
  overtime_hours: number;
  double_time_hours: number;
  total_hours: number;
  regular_rate: number;
  overtime_rate: number;
  double_time_rate: number;
  total_pay: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ExportRequest = await req.json();
    const { payPeriodId, format, options = {} } = body;
    const {
      includeRegular = true,
      includeOvertime = true,
      includeDoubleTime = true,
      includeRates = true,
    } = options;

    // Get pay period
    const { data: period, error: periodError } = await supabase
      .from("pay_periods")
      .select("*")
      .eq("id", payPeriodId)
      .single();

    if (periodError || !period) {
      return new Response(
        JSON.stringify({ error: "Pay period not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Exporting payroll for period ${period.start_date} to ${period.end_date}`);

    // Get approved timesheets for this period
    const { data: approvals, error: approvalsError } = await supabase
      .from("timesheet_approvals")
      .select(`
        *,
        user:profiles!timesheet_approvals_user_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("pay_period_id", payPeriodId)
      .eq("status", "approved");

    if (approvalsError) {
      console.error("Error fetching approvals:", approvalsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch timesheet data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pay rates for each user
    const userIds = approvals?.map((a) => a.user_id) || [];
    const { data: payRates } = await supabase
      .from("employee_pay_rates")
      .select("*")
      .in("user_id", userIds)
      .eq("is_current", true);

    const ratesByUser: Record<string, { hourly_rate: number; overtime_rate: number; double_time_rate: number }> = {};
    payRates?.forEach((rate) => {
      ratesByUser[rate.user_id] = {
        hourly_rate: rate.hourly_rate || 0,
        overtime_rate: rate.overtime_rate || rate.hourly_rate * 1.5,
        double_time_rate: rate.double_time_rate || rate.hourly_rate * 2,
      };
    });

    // Build export data
    const timesheetData: TimesheetData[] = (approvals || []).map((approval) => {
      const rates = ratesByUser[approval.user_id] || { hourly_rate: 0, overtime_rate: 0, double_time_rate: 0 };
      const regularHours = approval.regular_hours || 0;
      const overtimeHours = approval.overtime_hours || 0;
      const doubleTimeHours = approval.double_time_hours || 0;

      const regularPay = regularHours * rates.hourly_rate;
      const overtimePay = overtimeHours * rates.overtime_rate;
      const doubleTimePay = doubleTimeHours * rates.double_time_rate;

      return {
        user_id: approval.user_id,
        user_first_name: approval.user?.first_name || "",
        user_last_name: approval.user?.last_name || "",
        user_email: approval.user?.email || "",
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        double_time_hours: doubleTimeHours,
        total_hours: approval.total_hours || 0,
        regular_rate: rates.hourly_rate,
        overtime_rate: rates.overtime_rate,
        double_time_rate: rates.double_time_rate,
        total_pay: regularPay + overtimePay + doubleTimePay,
      };
    });

    console.log(`Processing ${timesheetData.length} timesheets for export`);

    // Generate export based on format
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "quickbooks_desktop":
        content = generateQuickBooksDesktop(timesheetData, period, { includeRegular, includeOvertime, includeDoubleTime, includeRates });
        filename = `payroll_${period.start_date}_${period.end_date}.iif`;
        mimeType = "application/octet-stream";
        break;
      case "quickbooks_online":
        content = generateQuickBooksOnline(timesheetData, period, { includeRegular, includeOvertime, includeDoubleTime, includeRates });
        filename = `payroll_${period.start_date}_${period.end_date}_qbo.csv`;
        mimeType = "text/csv";
        break;
      case "gusto":
        content = generateGusto(timesheetData, period, { includeRegular, includeOvertime, includeDoubleTime, includeRates });
        filename = `payroll_${period.start_date}_${period.end_date}_gusto.csv`;
        mimeType = "text/csv";
        break;
      case "adp":
        content = generateADP(timesheetData, period, { includeRegular, includeOvertime, includeDoubleTime, includeRates });
        filename = `payroll_${period.start_date}_${period.end_date}_adp.csv`;
        mimeType = "text/csv";
        break;
      case "csv":
      default:
        content = generateCSV(timesheetData, period, { includeRegular, includeOvertime, includeDoubleTime, includeRates });
        filename = `payroll_${period.start_date}_${period.end_date}.csv`;
        mimeType = "text/csv";
        break;
    }

    console.log(`Export generated: ${filename}`);

    return new Response(
      JSON.stringify({ content, filename, mimeType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface ExportOptions {
  includeRegular: boolean;
  includeOvertime: boolean;
  includeDoubleTime: boolean;
  includeRates: boolean;
}

function generateCSV(data: TimesheetData[], period: any, options: ExportOptions): string {
  const headers = ["Employee Name", "Email"];
  if (options.includeRegular) headers.push("Regular Hours");
  if (options.includeOvertime) headers.push("Overtime Hours");
  if (options.includeDoubleTime) headers.push("Double-Time Hours");
  headers.push("Total Hours");
  if (options.includeRates) {
    headers.push("Regular Rate", "Overtime Rate", "Double-Time Rate");
  }
  headers.push("Total Pay");

  const rows = data.map((row) => {
    const values = [`"${row.user_first_name} ${row.user_last_name}"`, `"${row.user_email}"`];
    if (options.includeRegular) values.push(row.regular_hours.toFixed(2));
    if (options.includeOvertime) values.push(row.overtime_hours.toFixed(2));
    if (options.includeDoubleTime) values.push(row.double_time_hours.toFixed(2));
    values.push(row.total_hours.toFixed(2));
    if (options.includeRates) {
      values.push(row.regular_rate.toFixed(2), row.overtime_rate.toFixed(2), row.double_time_rate.toFixed(2));
    }
    values.push(row.total_pay.toFixed(2));
    return values.join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function generateQuickBooksDesktop(data: TimesheetData[], period: any, options: ExportOptions): string {
  // IIF format for QuickBooks Desktop
  const lines = [
    "!TIMERHDR\tVER\tREL\tCOMPANYNAME\tIMPORTEDBY\tFROMTIMER\tFROMPAYROLL",
    "TIMERHDR\t8\t0\t\t\tN\tN",
    "!TIMEACT\tDATE\tJOB\tEMP\tITEM\tDURATION\tPROJ\tNOTE\tBILLINGSTATUS",
  ];

  data.forEach((row) => {
    const empName = `${row.user_first_name} ${row.user_last_name}`;
    if (options.includeRegular && row.regular_hours > 0) {
      lines.push(`TIMEACT\t${period.start_date}\t\t"${empName}"\tRegular\t${row.regular_hours}\t\t\t1`);
    }
    if (options.includeOvertime && row.overtime_hours > 0) {
      lines.push(`TIMEACT\t${period.start_date}\t\t"${empName}"\tOvertime\t${row.overtime_hours}\t\t\t1`);
    }
    if (options.includeDoubleTime && row.double_time_hours > 0) {
      lines.push(`TIMEACT\t${period.start_date}\t\t"${empName}"\tDouble-Time\t${row.double_time_hours}\t\t\t1`);
    }
  });

  return lines.join("\n");
}

function generateQuickBooksOnline(data: TimesheetData[], period: any, options: ExportOptions): string {
  // CSV format for QuickBooks Online import
  const headers = ["Employee", "Pay Period Start", "Pay Period End", "Hours Type", "Hours", "Rate", "Amount"];
  const rows: string[] = [];

  data.forEach((row) => {
    const empName = `"${row.user_first_name} ${row.user_last_name}"`;
    if (options.includeRegular && row.regular_hours > 0) {
      rows.push([empName, period.start_date, period.end_date, "Regular", row.regular_hours.toFixed(2), options.includeRates ? row.regular_rate.toFixed(2) : "", (row.regular_hours * row.regular_rate).toFixed(2)].join(","));
    }
    if (options.includeOvertime && row.overtime_hours > 0) {
      rows.push([empName, period.start_date, period.end_date, "Overtime", row.overtime_hours.toFixed(2), options.includeRates ? row.overtime_rate.toFixed(2) : "", (row.overtime_hours * row.overtime_rate).toFixed(2)].join(","));
    }
    if (options.includeDoubleTime && row.double_time_hours > 0) {
      rows.push([empName, period.start_date, period.end_date, "Double-Time", row.double_time_hours.toFixed(2), options.includeRates ? row.double_time_rate.toFixed(2) : "", (row.double_time_hours * row.double_time_rate).toFixed(2)].join(","));
    }
  });

  return [headers.join(","), ...rows].join("\n");
}

function generateGusto(data: TimesheetData[], period: any, options: ExportOptions): string {
  // Gusto hours import format
  const headers = ["email", "first_name", "last_name", "regular_hours", "overtime_hours", "double_overtime_hours"];
  const rows = data.map((row) => {
    return [
      row.user_email,
      row.user_first_name,
      row.user_last_name,
      options.includeRegular ? row.regular_hours.toFixed(2) : "0.00",
      options.includeOvertime ? row.overtime_hours.toFixed(2) : "0.00",
      options.includeDoubleTime ? row.double_time_hours.toFixed(2) : "0.00",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function generateADP(data: TimesheetData[], period: any, options: ExportOptions): string {
  // ADP import format
  const headers = ["File Number", "Employee Name", "Regular Hours", "Overtime Hours", "Double Time Hours", "Gross Pay"];
  const rows = data.map((row, index) => {
    return [
      (index + 1).toString().padStart(6, "0"),
      `"${row.user_first_name} ${row.user_last_name}"`,
      options.includeRegular ? row.regular_hours.toFixed(2) : "0.00",
      options.includeOvertime ? row.overtime_hours.toFixed(2) : "0.00",
      options.includeDoubleTime ? row.double_time_hours.toFixed(2) : "0.00",
      row.total_pay.toFixed(2),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
