import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log("[send-review-request] Processing scheduled review requests...");

    // Get scheduled requests ready to send
    const { data: requests, error: fetchError } = await supabase
      .from("review_requests")
      .select(`
        *,
        customer:customers(first_name, last_name, email, phone),
        job:jobs(title, completed_at),
        business:businesses(name, logo_url, email, slug)
      `)
      .eq("status", "scheduled")
      .lte("scheduled_send_at", new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error("[send-review-request] Fetch error:", fetchError);
      return errorResponse("Failed to fetch requests", 500);
    }

    if (!requests || requests.length === 0) {
      console.log("[send-review-request] No requests to process");
      return successResponse({ processed: 0 });
    }

    console.log(`[send-review-request] Processing ${requests.length} requests`);

    let sent = 0;
    let failed = 0;

    for (const request of requests) {
      try {
        const customer = request.customer as any;
        const business = request.business as any;
        const job = request.job as any;

        if (!customer || !business) {
          console.error(`[send-review-request] Missing data for request ${request.id}`);
          await markFailed(supabase, request.id, "Missing customer or business data");
          failed++;
          continue;
        }

        // Build review URL
        const baseUrl = `https://${supabaseUrl.replace("https://", "").split(".")[0]}.lovable.app`;
        const reviewUrl = `${baseUrl}/review/${request.token}`;

        if (request.channel === "email") {
          if (!resendApiKey) {
            console.error("[send-review-request] RESEND_API_KEY not configured");
            await markFailed(supabase, request.id, "Email not configured");
            failed++;
            continue;
          }

          // Send email via Resend
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${business.name} <reviews@${business.slug || "servicegrid"}.com>`,
              to: customer.email,
              subject: `How was your experience with ${business.name}?`,
              html: generateEmailHtml(customer, business, job, reviewUrl),
            }),
          });

          if (!emailResponse.ok) {
            const errorData = await emailResponse.text();
            console.error(`[send-review-request] Email failed:`, errorData);
            await markFailed(supabase, request.id, `Email send failed: ${errorData}`);
            failed++;
            continue;
          }

          const emailResult = await emailResponse.json();
          
          await supabase
            .from("review_requests")
            .update({
              status: "sent",
              actual_sent_at: new Date().toISOString(),
              message_id: emailResult.id,
            })
            .eq("id", request.id);

          sent++;
          console.log(`[send-review-request] Sent email for request ${request.id}`);

        } else if (request.channel === "sms") {
          // SMS via Twilio
          const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

          if (!twilioSid || !twilioToken || !twilioPhone) {
            console.error("[send-review-request] Twilio not configured");
            await markFailed(supabase, request.id, "SMS not configured");
            failed++;
            continue;
          }

          const smsBody = `Hi ${customer.first_name}! How was your recent service with ${business.name}? We'd love your feedback: ${reviewUrl}`;

          const smsResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                From: twilioPhone,
                To: customer.phone,
                Body: smsBody,
              }),
            }
          );

          if (!smsResponse.ok) {
            const errorData = await smsResponse.text();
            console.error(`[send-review-request] SMS failed:`, errorData);
            await markFailed(supabase, request.id, `SMS send failed: ${errorData}`);
            failed++;
            continue;
          }

          const smsResult = await smsResponse.json();

          await supabase
            .from("review_requests")
            .update({
              status: "sent",
              actual_sent_at: new Date().toISOString(),
              message_id: smsResult.sid,
            })
            .eq("id", request.id);

          sent++;
          console.log(`[send-review-request] Sent SMS for request ${request.id}`);
        }
      } catch (err) {
        console.error(`[send-review-request] Error processing request ${request.id}:`, err);
        await markFailed(supabase, request.id, err instanceof Error ? err.message : "Unknown error");
        failed++;
      }
    }

    console.log(`[send-review-request] Completed: ${sent} sent, ${failed} failed`);
    return successResponse({ processed: requests.length, sent, failed });
  } catch (error) {
    console.error("[send-review-request] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});

async function markFailed(supabase: any, requestId: string, errorMessage: string) {
  const { data: request } = await supabase
    .from("review_requests")
    .select("retry_count")
    .eq("id", requestId)
    .single();

  const retryCount = (request?.retry_count || 0) + 1;
  const status = retryCount >= 3 ? "failed" : "scheduled";
  
  // If still retrying, schedule for 1 hour later
  const scheduledSendAt = retryCount < 3 
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : undefined;

  await supabase
    .from("review_requests")
    .update({
      status,
      error_message: errorMessage,
      retry_count: retryCount,
      ...(scheduledSendAt && { scheduled_send_at: scheduledSendAt }),
    })
    .eq("id", requestId);
}

function generateEmailHtml(customer: any, business: any, job: any, reviewUrl: string): string {
  const customerName = customer.first_name || "Valued Customer";
  const jobTitle = job?.title || "your recent service";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Feedback</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981, #059669); padding: 40px 40px 30px; text-align: center;">
              ${business.logo_url ? `<img src="${business.logo_url}" alt="${business.name}" style="max-height: 60px; margin-bottom: 16px;">` : ""}
              <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 600;">How was your experience?</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi ${customerName},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thank you for choosing ${business.name} for ${jobTitle}. We hope everything went smoothly!
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                We'd love to hear about your experience. It only takes a minute and helps us serve you better.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      Share Your Feedback
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                This link will expire in 30 days.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                ${business.name}<br>
                <a href="#" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from review requests</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
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
