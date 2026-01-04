import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Webhook signature verification failed:", errMessage);
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // For development without signature verification
      event = JSON.parse(body);
      console.warn("Webhook signature verification skipped - configure STRIPE_WEBHOOK_SECRET for production");
    }

    console.log("Received Stripe webhook:", event.type);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle successful checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const invoiceId = session.metadata?.invoice_id;
      const businessId = session.metadata?.business_id;
      const paymentIntentId = session.payment_intent as string;

      if (!invoiceId || !businessId) {
        console.error("Missing invoice_id or business_id in session metadata");
        return new Response(JSON.stringify({ received: true }), {
          headers: corsHeaders,
          status: 200,
        });
      }

      console.log("Processing payment for invoice:", invoiceId);

      // Get the payment intent to get actual amount paid
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const amountPaid = paymentIntent.amount_received / 100; // Convert from cents

      // Get current invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("id, total, amount_paid, balance_due")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoice) {
        console.error("Invoice not found:", invoiceError);
        throw new Error("Invoice not found");
      }

      const newAmountPaid = Number(invoice.amount_paid) + amountPaid;
      const newBalanceDue = Math.max(0, Number(invoice.total) - newAmountPaid);
      const isPaid = newBalanceDue <= 0;

      // Record payment
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          invoice_id: invoiceId,
          business_id: businessId,
          amount: amountPaid,
          payment_method: "card",
          stripe_payment_intent_id: paymentIntentId,
          status: "completed",
          paid_at: new Date().toISOString(),
        });

      if (paymentError) {
        console.error("Failed to record payment:", paymentError);
        throw new Error("Failed to record payment");
      }

      // Update invoice
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: isPaid ? "paid" : "sent",
          paid_at: isPaid ? new Date().toISOString() : null,
        })
        .eq("id", invoiceId);

      if (updateError) {
        console.error("Failed to update invoice:", updateError);
        throw new Error("Failed to update invoice");
      }

      console.log("Payment recorded successfully:", {
        invoice_id: invoiceId,
        amount: amountPaid,
        new_balance: newBalanceDue,
        status: isPaid ? "paid" : "sent",
      });
    }

    // Handle checkout session expired (customer abandoned)
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const invoiceId = session.metadata?.invoice_id;
      const businessId = session.metadata?.business_id;

      console.log("Checkout session expired:", {
        session_id: session.id,
        invoice_id: invoiceId,
        business_id: businessId,
      });

      // Log the abandoned checkout but don't record as failed payment
      // This is just for tracking/analytics purposes
      if (invoiceId && businessId) {
        console.log("Customer abandoned checkout for invoice:", invoiceId);
      }
    }

    // Handle payment failure
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      const invoiceId = paymentIntent.metadata?.invoice_id;
      const businessId = paymentIntent.metadata?.business_id;
      const failureMessage = paymentIntent.last_payment_error?.message || "Payment failed";
      const failureCode = paymentIntent.last_payment_error?.code || "unknown";

      console.log("Payment failed:", {
        payment_intent_id: paymentIntent.id,
        invoice_id: invoiceId,
        business_id: businessId,
        failure_message: failureMessage,
        failure_code: failureCode,
      });

      if (invoiceId && businessId) {
        // Record failed payment attempt
        const { error: paymentError } = await supabase
          .from("payments")
          .insert({
            invoice_id: invoiceId,
            business_id: businessId,
            amount: paymentIntent.amount / 100,
            payment_method: "card",
            stripe_payment_intent_id: paymentIntent.id,
            status: "failed",
            notes: `Failed: ${failureMessage} (${failureCode})`,
          });

        if (paymentError) {
          console.error("Failed to record failed payment:", paymentError);
        } else {
          console.log("Failed payment recorded for invoice:", invoiceId);
        }

        // Send failure notification email
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-failed-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              invoice_id: invoiceId,
              failure_reason: failureMessage,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error("Failed to send payment failed email:", errorText);
          } else {
            console.log("Payment failed notification email sent for invoice:", invoiceId);
          }
        } catch (emailError) {
          console.error("Error calling send-payment-failed-email:", emailError);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
