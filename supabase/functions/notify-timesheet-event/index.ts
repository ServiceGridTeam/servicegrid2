import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createNotification, notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTimesheetEventRequest {
  eventType: "submitted" | "approved" | "rejected";
  timesheetApprovalId: string;
  businessId: string;
  userId: string;
  payPeriodId: string;
  reviewerId?: string;
  rejectionReason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyTimesheetEventRequest = await req.json();
    const { eventType, timesheetApprovalId, businessId, userId, payPeriodId, reviewerId, rejectionReason } = body;

    // Get user details
    const { data: user } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .single();

    const userName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email : "A team member";

    // Get pay period details
    const { data: payPeriod } = await supabase
      .from("pay_periods")
      .select("start_date, end_date")
      .eq("id", payPeriodId)
      .single();

    const periodLabel = payPeriod 
      ? `${new Date(payPeriod.start_date).toLocaleDateString()} - ${new Date(payPeriod.end_date).toLocaleDateString()}`
      : "current period";

    let notificationResults: { notified: number; skipped: number; failed: number } = { notified: 0, skipped: 0, failed: 0 };

    switch (eventType) {
      case "submitted": {
        // Notify all managers/admins when a timesheet is submitted
        const { data: managers } = await supabase
          .from("profiles")
          .select("id")
          .eq("business_id", businessId)
          .in("role", ["owner", "admin"]);

        if (managers) {
          for (const manager of managers) {
            const result = await createNotification(supabase, {
              userId: manager.id,
              businessId,
              type: "timesheet" as any,
              title: "Timesheet Submitted for Review",
              message: `${userName} has submitted their timesheet for ${periodLabel}`,
              data: { timesheetApprovalId, payPeriodId, workerId: userId },
            });
            if (result.success && !result.skipped) notificationResults.notified++;
            else if (result.skipped) notificationResults.skipped++;
            else notificationResults.failed++;
          }
        }
        break;
      }

      case "approved": {
        // Notify the worker when their timesheet is approved
        let reviewerName = "A manager";
        if (reviewerId) {
          const { data: reviewer } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", reviewerId)
            .single();
          if (reviewer) {
            reviewerName = `${reviewer.first_name || ""} ${reviewer.last_name || ""}`.trim() || "A manager";
          }
        }

        const result = await createNotification(supabase, {
          userId,
          businessId,
          type: "timesheet" as any,
          title: "Timesheet Approved",
          message: `Your timesheet for ${periodLabel} has been approved by ${reviewerName}`,
          data: { timesheetApprovalId, payPeriodId },
        });
        if (result.success && !result.skipped) notificationResults.notified++;
        else if (result.skipped) notificationResults.skipped++;
        else notificationResults.failed++;
        break;
      }

      case "rejected": {
        // Notify the worker when their timesheet is rejected
        let reviewerName = "A manager";
        if (reviewerId) {
          const { data: reviewer } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", reviewerId)
            .single();
          if (reviewer) {
            reviewerName = `${reviewer.first_name || ""} ${reviewer.last_name || ""}`.trim() || "A manager";
          }
        }

        const message = rejectionReason
          ? `Your timesheet for ${periodLabel} was rejected by ${reviewerName}: "${rejectionReason}"`
          : `Your timesheet for ${periodLabel} was rejected by ${reviewerName}`;

        const result = await createNotification(supabase, {
          userId,
          businessId,
          type: "timesheet" as any,
          title: "Timesheet Rejected",
          message,
          data: { timesheetApprovalId, payPeriodId, rejectionReason },
        });
        if (result.success && !result.skipped) notificationResults.notified++;
        else if (result.skipped) notificationResults.skipped++;
        else notificationResults.failed++;
        break;
      }
    }

    console.log(`Timesheet ${eventType} notification sent:`, notificationResults);

    return new Response(
      JSON.stringify({ success: true, ...notificationResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-timesheet-event:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
