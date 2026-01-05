import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Use service role client for database queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's business
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.business_id) {
      throw new Error("No business found for user");
    }

    // Get business Stripe account ID
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, stripe_account_id, stripe_onboarding_complete")
      .eq("id", profile.business_id)
      .single();

    if (bizError || !business) {
      throw new Error("Business not found");
    }

    if (!business.stripe_account_id) {
      return new Response(
        JSON.stringify({
          status: "not_started",
          onboarding_complete: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(business.stripe_account_id);

    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;
    const detailsSubmitted = account.details_submitted;

    // Determine onboarding status
    let status = "pending";
    if (chargesEnabled && payoutsEnabled) {
      status = "complete";
    } else if (detailsSubmitted) {
      status = "restricted";
    }

    const isComplete = chargesEnabled && payoutsEnabled;

    // Update database if status changed
    if (isComplete !== business.stripe_onboarding_complete) {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ stripe_onboarding_complete: isComplete })
        .eq("id", business.id);

      if (updateError) {
        console.error("Failed to update onboarding status:", updateError);
      }
    }

    console.log("Stripe account status:", {
      account_id: business.stripe_account_id,
      status,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    });

    return new Response(
      JSON.stringify({
        status,
        onboarding_complete: isComplete,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe Connect status error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
