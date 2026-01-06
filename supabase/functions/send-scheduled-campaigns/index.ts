import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find campaigns that are scheduled and due
    const { data: dueCampaigns, error: fetchError } = await supabase
      .from("campaigns")
      .select("id, name, scheduled_at")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchError) throw fetchError;

    console.log(`Found ${dueCampaigns?.length || 0} scheduled campaigns due for sending`);

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No campaigns due", triggered: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let triggered = 0;
    const errors: string[] = [];

    for (const campaign of dueCampaigns) {
      try {
        // Update status to 'sending' before triggering
        await supabase
          .from("campaigns")
          .update({ status: "sending", sent_at: now })
          .eq("id", campaign.id);

        // Invoke send-campaign-emails function
        const { error: invokeError } = await supabase.functions.invoke(
          "send-campaign-emails",
          { body: { campaign_id: campaign.id } }
        );

        if (invokeError) {
          console.error(`Error triggering campaign ${campaign.id}:`, invokeError);
          errors.push(`${campaign.id}: ${invokeError.message}`);
          // Revert status on error
          await supabase
            .from("campaigns")
            .update({ status: "scheduled" })
            .eq("id", campaign.id);
        } else {
          console.log(`Triggered campaign: ${campaign.name} (${campaign.id})`);
          triggered++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${campaign.id}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Triggered ${triggered} campaigns`,
        triggered,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-scheduled-campaigns:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
