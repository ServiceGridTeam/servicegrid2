import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    click?: {
      link: string;
      timestamp: string;
    };
    bounce?: {
      message: string;
    };
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: ResendWebhookPayload = await req.json();

    console.log(`Received Resend webhook: ${payload.type}`, JSON.stringify(payload.data));

    const resendId = payload.data.email_id;
    const now = new Date().toISOString();

    if (!resendId) {
      console.log("No email_id in payload, skipping");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find the email_send record by resend_id
    const { data: emailSend, error: findError } = await supabase
      .from("email_sends")
      .select("*")
      .eq("resend_id", resendId)
      .single();

    if (findError || !emailSend) {
      console.log(`No email_sends record found for resend_id: ${resendId}`);
      return new Response(JSON.stringify({ received: true, found: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found email_send: ${emailSend.id}`);

    let updateData: Record<string, unknown> = {};
    let updateCustomer = false;
    let customerEmailStatus: string | null = null;

    switch (payload.type) {
      case "email.delivered":
        updateData = {
          status: "delivered",
          delivered_at: now,
        };
        break;

      case "email.opened":
        updateData = {
          status: emailSend.status === "clicked" ? "clicked" : "opened",
          opened_at: emailSend.opened_at || now,
          open_count: (emailSend.open_count || 0) + 1,
        };
        updateCustomer = true;
        break;

      case "email.clicked":
        const clickedLink = payload.data.click?.link || "";
        const existingLinks = (emailSend.clicked_links as Array<{url: string, clicked_at: string}>) || [];
        existingLinks.push({ url: clickedLink, clicked_at: now });

        updateData = {
          status: "clicked",
          clicked_at: emailSend.clicked_at || now,
          click_count: (emailSend.click_count || 0) + 1,
          clicked_links: existingLinks,
        };
        updateCustomer = true;
        break;

      case "email.bounced":
        updateData = {
          status: "bounced",
          bounced_at: now,
          error_message: payload.data.bounce?.message || "Email bounced",
        };
        customerEmailStatus = "bounced";
        break;

      case "email.complained":
        updateData = {
          status: "complained",
          complained_at: now,
        };
        customerEmailStatus = "complained";
        break;

      case "email.unsubscribed":
        updateData = {
          status: "unsubscribed",
          unsubscribed_at: now,
        };
        // Handle unsubscribe via email_preferences
        if (emailSend.customer_id) {
          await handleUnsubscribe(supabase, emailSend.customer_id);
        }
        break;

      default:
        console.log(`Unhandled event type: ${payload.type}`);
        return new Response(JSON.stringify({ received: true, handled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    // Update email_sends record
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("email_sends")
        .update(updateData)
        .eq("id", emailSend.id);

      if (updateError) {
        console.error("Error updating email_sends:", updateError);
      }
    }

    // Update campaign stats if this is a campaign email
    if (emailSend.campaign_id) {
      await updateCampaignStats(supabase, emailSend.campaign_id, payload.type);
    }

    // Update sequence step stats if this is a sequence email
    if (emailSend.step_id) {
      await updateSequenceStepStats(supabase, emailSend.step_id, payload.type);
    }

    // Update customer record if needed
    if (emailSend.customer_id) {
      if (customerEmailStatus) {
        await supabase
          .from("customers")
          .update({ email_status: customerEmailStatus })
          .eq("id", emailSend.customer_id);

        // Pause active sequence enrollments if bounced/complained
        if (customerEmailStatus === "bounced" || customerEmailStatus === "complained") {
          await supabase
            .from("sequence_enrollments")
            .update({ 
              status: "paused", 
              paused_at: now,
            })
            .eq("customer_id", emailSend.customer_id)
            .eq("status", "active");
        }
      }

      if (updateCustomer && (payload.type === "email.opened" || payload.type === "email.clicked")) {
        // Update customer engagement tracking
        const { data: customer } = await supabase
          .from("customers")
          .select("email_engagement_score")
          .eq("id", emailSend.customer_id)
          .single();

        // Increase engagement score on open/click (max 100)
        const currentScore = customer?.email_engagement_score || 50;
        const increase = payload.type === "email.clicked" ? 5 : 2;
        const newScore = Math.min(100, currentScore + increase);

        await supabase
          .from("customers")
          .update({ 
            last_email_opened_at: now,
            email_engagement_score: newScore,
          })
          .eq("id", emailSend.customer_id);
      }
    }

    console.log(`Successfully processed ${payload.type} event for email ${resendId}`);

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing Resend webhook:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function updateCampaignStats(supabase: any, campaignId: string, eventType: string) {
  const statFields: Record<string, string> = {
    "email.delivered": "delivered_count",
    "email.opened": "opened_count",
    "email.clicked": "clicked_count",
    "email.bounced": "bounced_count",
    "email.complained": "complained_count",
    "email.unsubscribed": "unsubscribed_count",
  };

  const field = statFields[eventType];
  if (!field) return;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(field)
    .eq("id", campaignId)
    .single();

  if (campaign) {
    const currentValue = campaign[field] || 0;
    await supabase
      .from("campaigns")
      .update({ [field]: currentValue + 1 })
      .eq("id", campaignId);
  }
}

// deno-lint-ignore no-explicit-any
async function updateSequenceStepStats(supabase: any, stepId: string, eventType: string) {
  // Handle delivered, opened, and clicked events
  const statFields: Record<string, string> = {
    "email.delivered": "total_sent",
    "email.opened": "total_opened",
    "email.clicked": "total_clicked",
  };

  const field = statFields[eventType];
  if (!field) return;

  const { data: step } = await supabase
    .from("sequence_steps")
    .select(field)
    .eq("id", stepId)
    .single();

  if (step) {
    const currentValue = step[field] || 0;
    await supabase
      .from("sequence_steps")
      .update({ [field]: currentValue + 1 })
      .eq("id", stepId);
  }
}

// deno-lint-ignore no-explicit-any
async function handleUnsubscribe(supabase: any, customerId: string) {
  const now = new Date().toISOString();

  // Get customer's business_id
  const { data: customer } = await supabase
    .from("customers")
    .select("business_id, email")
    .eq("id", customerId)
    .single();

  if (!customer) return;

  // Update or create email_preferences
  await supabase
    .from("email_preferences")
    .upsert({
      business_id: customer.business_id,
      customer_id: customerId,
      subscribed_marketing: false,
      unsubscribed_at: now,
      unsubscribe_reason: "email_link",
    }, {
      onConflict: "customer_id",
    });

  // Cancel active sequence enrollments
  await supabase
    .from("sequence_enrollments")
    .update({ 
      status: "unsubscribed", 
      unsubscribed_at: now,
    })
    .eq("customer_id", customerId)
    .eq("status", "active");
}
