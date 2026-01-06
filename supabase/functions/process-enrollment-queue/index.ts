import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function processes the enrollment queue and calls trigger-sequence-enrollment for each item
// It should be called by a cron job every minute

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Processing sequence enrollment queue...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch unprocessed queue items (limit to 50 per run to avoid timeout)
    const { data: queueItems, error: fetchError } = await supabase
      .from("sequence_enrollment_queue")
      .select("*")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching queue items:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${queueItems?.length || 0} queue items to process`);

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No queue items to process", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const results = {
      processed: 0,
      enrolled: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const item of queueItems) {
      try {
        // Call the trigger-sequence-enrollment function
        const { data, error } = await supabase.functions.invoke("trigger-sequence-enrollment", {
          body: {
            trigger_type: item.trigger_type,
            customer_id: item.customer_id,
            business_id: item.business_id,
            metadata: {
              source_table: item.source_table,
              source_id: item.source_id,
            },
          },
        });

        if (error) {
          console.error(`Error processing queue item ${item.id}:`, error);
          results.failed++;
          results.errors.push(`${item.id}: ${error.message}`);
          continue;
        }

        // Mark as processed
        await supabase
          .from("sequence_enrollment_queue")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", item.id);

        results.processed++;
        results.enrolled += data?.enrolled || 0;

        console.log(`Processed queue item ${item.id}, enrolled in ${data?.enrolled || 0} sequences`);

        // Small delay to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 100));

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error processing queue item ${item.id}:`, err);
        results.failed++;
        results.errors.push(`${item.id}: ${errorMessage}`);
      }
    }

    console.log(`Queue processing complete. Processed: ${results.processed}, Enrolled: ${results.enrolled}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} queue items`,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in process-enrollment-queue:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
