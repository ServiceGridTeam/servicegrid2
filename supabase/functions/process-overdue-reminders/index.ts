import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimum days between reminders for the same invoice
const REMINDER_INTERVAL_DAYS = 3;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting overdue invoice reminder processing...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date thresholds
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    const reminderThreshold = new Date();
    reminderThreshold.setDate(reminderThreshold.getDate() - REMINDER_INTERVAL_DAYS);
    const reminderThresholdStr = reminderThreshold.toISOString();

    console.log(`Looking for overdue invoices (due before ${todayStr}, last reminder before ${reminderThresholdStr})`);

    // Find overdue invoices that haven't had a recent reminder
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, balance_due, business_id")
      .eq("status", "sent")
      .lt("due_date", todayStr)
      .gt("balance_due", 0)
      .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${reminderThresholdStr}`);

    if (fetchError) {
      console.error("Error fetching overdue invoices:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${overdueInvoices?.length || 0} overdue invoices needing reminders`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No overdue invoices need reminders",
          results,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Process each overdue invoice
    for (const invoice of overdueInvoices) {
      results.processed++;
      console.log(`Processing invoice ${invoice.invoice_number} (${invoice.id})`);

      try {
        // Call the send-reminder-email function
        const { error: sendError } = await supabase.functions.invoke(
          "send-reminder-email",
          {
            body: { invoice_id: invoice.id },
          }
        );

        if (sendError) {
          console.error(`Failed to send reminder for invoice ${invoice.invoice_number}:`, sendError);
          results.failed++;
          results.errors.push(`${invoice.invoice_number}: ${sendError.message}`);
          continue;
        }

        // Update the last_reminder_sent_at timestamp
        const { error: updateError } = await supabase
          .from("invoices")
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .eq("id", invoice.id);

        if (updateError) {
          console.error(`Failed to update reminder timestamp for invoice ${invoice.invoice_number}:`, updateError);
          // Don't count as failed since email was sent
        }

        results.sent++;
        console.log(`Successfully sent reminder for invoice ${invoice.invoice_number}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error processing invoice ${invoice.invoice_number}:`, err);
        results.failed++;
        results.errors.push(`${invoice.invoice_number}: ${errorMessage}`);
      }
    }

    console.log(`Reminder processing complete. Sent: ${results.sent}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} overdue invoices`,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in process-overdue-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
