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

    const { invoice_token, success_url, cancel_url } = await req.json();

    if (!invoice_token) {
      throw new Error("Invoice token is required");
    }

    // Get invoice by public token
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        balance_due,
        customer_id,
        business_id,
        customer:customers(first_name, last_name, email),
        business:businesses(name, stripe_account_id, stripe_onboarding_complete)
      `)
      .eq("public_token", invoice_token)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      throw new Error("Invoice not found");
    }

    const business = invoice.business as any;
    const customer = invoice.customer as any;

    if (!business?.stripe_account_id || !business?.stripe_onboarding_complete) {
      throw new Error("Business is not set up to accept payments");
    }

    const balanceDue = Number(invoice.balance_due);
    if (balanceDue <= 0) {
      throw new Error("Invoice has no balance due");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Create Stripe Checkout session with destination charge
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(balanceDue * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: 0, // No platform fee for now
        transfer_data: {
          destination: business.stripe_account_id,
        },
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          business_id: invoice.business_id,
        },
      },
      customer_email: customer?.email || undefined,
      success_url: success_url || `${req.headers.get("origin")}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/invoice/${invoice_token}`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_token: invoice_token,
        business_id: invoice.business_id,
      },
    });

    console.log("Checkout session created:", session.id, "for invoice:", invoice.invoice_number);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe checkout error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
