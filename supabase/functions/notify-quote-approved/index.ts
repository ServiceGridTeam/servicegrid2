import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyQuoteApprovedRequest {
  quoteId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: NotifyQuoteApprovedRequest = await req.json();
    const { quoteId } = body;

    console.log(`Sending notification for approved quote: ${quoteId}`);

    // Fetch quote with customer and business info
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        id,
        quote_number,
        approved_by,
        business_id,
        customer:customers(first_name, last_name)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Failed to fetch quote:", quoteError);
      return new Response(
        JSON.stringify({ error: "Quote not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const customer = quote.customer as unknown as { first_name: string; last_name: string } | null;
    const customerName = customer 
      ? `${customer.first_name} ${customer.last_name}`.trim() 
      : quote.approved_by || "Customer";

    // Notify all business team members
    const result = await notifyBusinessTeam(supabase, quote.business_id, {
      type: "quote",
      title: "Quote Approved",
      message: `Quote #${quote.quote_number} has been approved by ${customerName}`,
      data: { quoteId: quote.id, quoteNumber: quote.quote_number },
    });

    console.log(`Notification result: ${JSON.stringify(result)}`);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-quote-approved:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
