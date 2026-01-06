import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
};

interface ActionRequest {
  action: string;
  paymentMethodId?: string;
  invoiceId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session token from header
    const sessionToken = req.headers.get("x-portal-session");
    if (!sessionToken) {
      return errorResponse("Unauthorized", 401);
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("customer_portal_sessions")
      .select("customer_account_id, active_customer_id, active_business_id")
      .eq("token", sessionToken)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return errorResponse("Invalid or expired session", 401);
    }

    if (!stripeSecretKey) {
      return errorResponse("Payment processing is not configured", 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const body: ActionRequest = await req.json();
    const { action } = body;

    console.log(`[portal-payment-methods] Action: ${action}`);

    switch (action) {
      case "list":
        return await handleList(supabase, session);
      case "create-setup-intent":
        return await handleCreateSetupIntent(supabase, stripe, session);
      case "create-payment-intent":
        return await handleCreatePaymentIntent(supabase, stripe, session, body.invoiceId, body.paymentMethodId);
      case "set-default":
        return await handleSetDefault(supabase, session, body.paymentMethodId);
      case "delete":
        return await handleDelete(supabase, stripe, session, body.paymentMethodId);
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error: unknown) {
    console.error("[portal-payment-methods] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(errorMessage, 500);
  }
});

async function handleList(supabase: any, session: any) {
  const { data: methods, error } = await supabase
    .from("customer_payment_methods")
    .select("id, brand, last4, exp_month, exp_year, is_default, stripe_payment_method_id")
    .eq("customer_account_id", session.customer_account_id)
    .eq("business_id", session.active_business_id);

  if (error) {
    console.error("[portal-payment-methods] List error:", error);
    return errorResponse("Failed to fetch payment methods", 500);
  }

  const formatted = (methods || []).map((m: any) => ({
    id: m.id,
    stripeId: m.stripe_payment_method_id,
    brand: m.brand,
    last4: m.last4,
    expMonth: m.exp_month,
    expYear: m.exp_year,
    isDefault: m.is_default,
  }));

  return successResponse(formatted);
}

async function handleCreateSetupIntent(supabase: any, stripe: Stripe, session: any) {
  // Get or create Stripe customer
  const stripeCustomerId = await getOrCreateStripeCustomer(supabase, stripe, session);

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    metadata: {
      customer_account_id: session.customer_account_id,
      business_id: session.active_business_id,
    },
  });

  console.log(`[portal-payment-methods] SetupIntent created: ${setupIntent.id}`);
  return successResponse({ clientSecret: setupIntent.client_secret });
}

async function handleCreatePaymentIntent(
  supabase: any,
  stripe: Stripe,
  session: any,
  invoiceId?: string,
  paymentMethodId?: string
) {
  if (!invoiceId) {
    return errorResponse("Invoice ID is required", 400);
  }

  // Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, total, balance_due, status, customer_id, business_id, invoice_number")
    .eq("id", invoiceId)
    .eq("customer_id", session.active_customer_id)
    .single();

  if (invoiceError || !invoice) {
    return errorResponse("Invoice not found", 404);
  }

  if (invoice.status === "Paid") {
    return errorResponse("Invoice is already paid", 400);
  }

  const amount = Math.round((invoice.balance_due || invoice.total || 0) * 100); // cents
  if (amount <= 0) {
    return errorResponse("Invalid payment amount", 400);
  }

  // Get or create Stripe customer
  const stripeCustomerId = await getOrCreateStripeCustomer(supabase, stripe, session);

  // Get business Stripe Connect account (if using Connect)
  const { data: business } = await supabase
    .from("businesses")
    .select("stripe_account_id")
    .eq("id", session.active_business_id)
    .single();

  const paymentIntentData: Stripe.PaymentIntentCreateParams = {
    amount,
    currency: "usd",
    customer: stripeCustomerId,
    metadata: {
      invoice_id: invoiceId,
      invoice_number: invoice.invoice_number,
      customer_account_id: session.customer_account_id,
      business_id: session.active_business_id,
    },
  };

  // If using Stripe Connect
  if (business?.stripe_account_id) {
    paymentIntentData.transfer_data = {
      destination: business.stripe_account_id,
    };
  }

  // If a saved payment method is provided, attach it
  if (paymentMethodId) {
    // Get the Stripe payment method ID from our DB
    const { data: pm } = await supabase
      .from("customer_payment_methods")
      .select("stripe_payment_method_id")
      .eq("id", paymentMethodId)
      .eq("customer_account_id", session.customer_account_id)
      .single();

    if (pm?.stripe_payment_method_id) {
      paymentIntentData.payment_method = pm.stripe_payment_method_id;
      paymentIntentData.confirm = true;
      paymentIntentData.return_url = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/portal/documents`;
    }
  }

  const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

  console.log(`[portal-payment-methods] PaymentIntent created: ${paymentIntent.id} for invoice ${invoiceId}`);
  
  return successResponse({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  });
}

async function handleSetDefault(supabase: any, session: any, paymentMethodId?: string) {
  if (!paymentMethodId) {
    return errorResponse("Payment method ID is required", 400);
  }

  // Clear all defaults first
  await supabase
    .from("customer_payment_methods")
    .update({ is_default: false })
    .eq("customer_account_id", session.customer_account_id)
    .eq("business_id", session.active_business_id);

  // Set new default
  const { error } = await supabase
    .from("customer_payment_methods")
    .update({ is_default: true })
    .eq("id", paymentMethodId)
    .eq("customer_account_id", session.customer_account_id);

  if (error) {
    console.error("[portal-payment-methods] Set default error:", error);
    return errorResponse("Failed to set default payment method", 500);
  }

  return successResponse({ success: true });
}

async function handleDelete(supabase: any, stripe: Stripe, session: any, paymentMethodId?: string) {
  if (!paymentMethodId) {
    return errorResponse("Payment method ID is required", 400);
  }

  // Get the Stripe payment method ID
  const { data: pm, error: fetchError } = await supabase
    .from("customer_payment_methods")
    .select("stripe_payment_method_id")
    .eq("id", paymentMethodId)
    .eq("customer_account_id", session.customer_account_id)
    .single();

  if (fetchError || !pm) {
    return errorResponse("Payment method not found", 404);
  }

  // Detach from Stripe
  try {
    await stripe.paymentMethods.detach(pm.stripe_payment_method_id);
  } catch (stripeError: any) {
    console.error("[portal-payment-methods] Stripe detach error:", stripeError.message);
    // Continue to delete from DB even if Stripe fails
  }

  // Delete from DB
  const { error: deleteError } = await supabase
    .from("customer_payment_methods")
    .delete()
    .eq("id", paymentMethodId);

  if (deleteError) {
    console.error("[portal-payment-methods] Delete error:", deleteError);
    return errorResponse("Failed to delete payment method", 500);
  }

  return successResponse({ success: true });
}

async function getOrCreateStripeCustomer(supabase: any, stripe: Stripe, session: any): Promise<string> {
  // Check if we have a stored Stripe customer ID
  const { data: account } = await supabase
    .from("customer_accounts")
    .select("email")
    .eq("id", session.customer_account_id)
    .single();

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, last_name, email")
    .eq("id", session.active_customer_id)
    .single();

  // Check for existing payment method with Stripe customer ID
  const { data: existingPM } = await supabase
    .from("customer_payment_methods")
    .select("stripe_customer_id")
    .eq("customer_account_id", session.customer_account_id)
    .eq("business_id", session.active_business_id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .single();

  if (existingPM?.stripe_customer_id) {
    return existingPM.stripe_customer_id;
  }

  // Create new Stripe customer
  const email = account?.email || customer?.email;
  const name = customer ? `${customer.first_name} ${customer.last_name}` : undefined;

  const stripeCustomer = await stripe.customers.create({
    email,
    name,
    metadata: {
      customer_account_id: session.customer_account_id,
      customer_id: session.active_customer_id,
      business_id: session.active_business_id,
    },
  });

  console.log(`[portal-payment-methods] Created Stripe customer: ${stripeCustomer.id}`);
  return stripeCustomer.id;
}

function successResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
