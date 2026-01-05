import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get user's business
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.business_id) {
      throw new Error("No business found for user");
    }

    // Get business details
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, name, email, stripe_account_id")
      .eq("id", profile.business_id)
      .single();

    if (bizError || !business) {
      throw new Error("Business not found");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const { return_url } = await req.json();

    let accountId = business.stripe_account_id;

    // Create Stripe Express account if none exists
    if (!accountId) {
      console.log("Creating new Stripe Express account for business:", business.id);
      
      const account = await stripe.accounts.create({
        type: "express",
        email: business.email || undefined,
        business_profile: {
          name: business.name,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Save account ID to database
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ stripe_account_id: accountId })
        .eq("id", business.id);

      if (updateError) {
        console.error("Failed to save Stripe account ID:", updateError);
        throw new Error("Failed to save Stripe account");
      }

      console.log("Stripe account created:", accountId);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: return_url,
      return_url: return_url,
      type: "account_onboarding",
    });

    console.log("Generated onboarding link for account:", accountId);

    return new Response(
      JSON.stringify({ url: accountLink.url, account_id: accountId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe Connect onboard error:", error);
    
    // Return 401 for auth-related errors
    const isAuthError = errorMessage.includes("authorization") || 
                        errorMessage.includes("Unauthorized") ||
                        errorMessage.includes("No authorization");
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: isAuthError ? 401 : 400,
      }
    );
  }
});
