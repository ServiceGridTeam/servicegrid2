import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCampaignRequest {
  campaign_id: string;
}

interface FilterConfig {
  tags?: string[];
  lead_status?: string[];
  email_status?: string[];
  source?: string[];
  cities?: string[];
  states?: string[];
  created_after?: string;
  created_before?: string;
  has_email?: boolean;
  exclude_unsubscribed?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Create authenticated client for user verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { campaign_id }: SendCampaignRequest = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-campaign-emails] Processing campaign: ${campaign_id}`);

    // Fetch campaign with segment
    const { data: campaign, error: campaignError } = await adminClient
      .from("campaigns")
      .select(`
        *,
        segment:audience_segments(id, name, filter_config)
      `)
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("[send-campaign-emails] Campaign not found:", campaignError);
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch business info for from email
    const { data: business } = await adminClient
      .from("businesses")
      .select("name, email")
      .eq("id", campaign.business_id)
      .single();

    const fromEmail = business?.email || "noreply@servicegrid.app";
    const fromName = business?.name || "ServiceGrid";

    // Build audience query based on filter config
    const filterConfig: FilterConfig = campaign.segment?.filter_config || {
      has_email: true,
      exclude_unsubscribed: true,
    };

    let customersQuery = adminClient
      .from("customers")
      .select("id, first_name, last_name, email, tags, lead_status, company_name")
      .eq("business_id", campaign.business_id)
      .not("email", "is", null);

    // Apply filters
    if (filterConfig.tags && filterConfig.tags.length > 0) {
      customersQuery = customersQuery.overlaps("tags", filterConfig.tags);
    }
    if (filterConfig.lead_status && filterConfig.lead_status.length > 0) {
      customersQuery = customersQuery.in("lead_status", filterConfig.lead_status);
    }
    if (filterConfig.email_status && filterConfig.email_status.length > 0) {
      customersQuery = customersQuery.in("email_status", filterConfig.email_status);
    }
    if (filterConfig.source && filterConfig.source.length > 0) {
      customersQuery = customersQuery.in("source", filterConfig.source);
    }
    if (filterConfig.cities && filterConfig.cities.length > 0) {
      customersQuery = customersQuery.in("city", filterConfig.cities);
    }
    if (filterConfig.states && filterConfig.states.length > 0) {
      customersQuery = customersQuery.in("state", filterConfig.states);
    }
    if (filterConfig.created_after) {
      customersQuery = customersQuery.gte("created_at", filterConfig.created_after);
    }
    if (filterConfig.created_before) {
      customersQuery = customersQuery.lte("created_at", filterConfig.created_before);
    }
    if (filterConfig.exclude_unsubscribed !== false) {
      customersQuery = customersQuery.or("email_status.is.null,email_status.neq.unsubscribed");
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error("[send-campaign-emails] Error fetching customers:", customersError);
      return new Response(JSON.stringify({ error: "Failed to fetch customers" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!customers || customers.length === 0) {
      console.log("[send-campaign-emails] No customers match the audience filters");
      await adminClient
        .from("campaigns")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: 0 })
        .eq("id", campaign_id);

      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-campaign-emails] Found ${customers.length} customers to email`);

    // Check email preferences for each customer
    const { data: preferences } = await adminClient
      .from("email_preferences")
      .select("customer_id, subscribed_marketing")
      .eq("business_id", campaign.business_id)
      .in(
        "customer_id",
        customers.map((c) => c.id)
      );

    const unsubscribedIds = new Set(
      preferences?.filter((p) => p.subscribed_marketing === false).map((p) => p.customer_id) || []
    );

    const eligibleCustomers = customers.filter((c) => !unsubscribedIds.has(c.id));

    console.log(`[send-campaign-emails] ${eligibleCustomers.length} customers are eligible after preference check`);

    let sentCount = 0;
    let failedCount = 0;

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < eligibleCustomers.length; i += batchSize) {
      const batch = eligibleCustomers.slice(i, i + batchSize);

      for (const customer of batch) {
        try {
          // Personalize email content
          let personalizedBody = campaign.body_html
            .replace(/\{\{first_name\}\}/gi, customer.first_name || "")
            .replace(/\{\{last_name\}\}/gi, customer.last_name || "")
            .replace(/\{\{email\}\}/gi, customer.email || "")
            .replace(/\{\{company_name\}\}/gi, customer.company_name || "")
            .replace(/\{\{business_name\}\}/gi, fromName);

          let personalizedSubject = campaign.subject
            .replace(/\{\{first_name\}\}/gi, customer.first_name || "")
            .replace(/\{\{last_name\}\}/gi, customer.last_name || "")
            .replace(/\{\{company_name\}\}/gi, customer.company_name || "")
            .replace(/\{\{business_name\}\}/gi, fromName);

          // Create email_sends record
          const { data: emailSend, error: sendRecordError } = await adminClient
            .from("email_sends")
            .insert({
              business_id: campaign.business_id,
              campaign_id: campaign.id,
              template_id: campaign.template_id,
              customer_id: customer.id,
              to_email: customer.email,
              to_name: `${customer.first_name} ${customer.last_name}`.trim(),
              subject: personalizedSubject,
              email_type: "campaign",
              status: "pending",
            })
            .select()
            .single();

          if (sendRecordError) {
            console.error(`[send-campaign-emails] Failed to create send record for ${customer.email}:`, sendRecordError);
            failedCount++;
            continue;
          }

          // Send via Resend if API key is configured
          if (resendApiKey) {
            const resendResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: customer.email,
                subject: personalizedSubject,
                html: personalizedBody,
              }),
            });

            if (resendResponse.ok) {
              const resendData = await resendResponse.json();
              await adminClient
                .from("email_sends")
                .update({
                  status: "sent",
                  sent_at: new Date().toISOString(),
                  resend_id: resendData.id,
                })
                .eq("id", emailSend.id);

              sentCount++;
            } else {
              const errorText = await resendResponse.text();
              console.error(`[send-campaign-emails] Resend error for ${customer.email}:`, errorText);
              await adminClient
                .from("email_sends")
                .update({
                  status: "failed",
                  error_message: errorText,
                })
                .eq("id", emailSend.id);
              failedCount++;
            }
          } else {
            // No Resend key - mark as sent for testing
            await adminClient
              .from("email_sends")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", emailSend.id);
            sentCount++;
            console.log(`[send-campaign-emails] (Test mode) Would send to ${customer.email}`);
          }

          // Rate limiting - 100ms between sends
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[send-campaign-emails] Error sending to ${customer.email}:`, error);
          failedCount++;
        }
      }

      // 2 second delay between batches
      if (i + batchSize < eligibleCustomers.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Update campaign stats
    await adminClient
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: sentCount,
        total_recipients: eligibleCustomers.length,
      })
      .eq("id", campaign_id);

    console.log(`[send-campaign-emails] Campaign complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: eligibleCustomers.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[send-campaign-emails] Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
