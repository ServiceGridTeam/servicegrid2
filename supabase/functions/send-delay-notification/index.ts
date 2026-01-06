import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DelayNotificationRequest {
  jobId: string;
  delayMinutes: number;
  newEta: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body: DelayNotificationRequest = await req.json();
    const { jobId, delayMinutes, newEta } = body;

    if (!jobId || !delayMinutes || !newEta) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job with customer and business info
    const { data: job, error: jobError } = await adminClient
      .from("jobs")
      .select(`
        *,
        customer:customers(*),
        business:businesses(*)
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customer = job.customer;
    const business = job.business;

    if (!customer?.email) {
      console.log("Customer has no email, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No customer email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we've already sent a notification recently (within 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentNotifications } = await adminClient
      .from("email_queue")
      .select("id")
      .eq("related_id", jobId)
      .eq("template_type", "delay_notification")
      .gte("created_at", thirtyMinutesAgo);

    if (recentNotifications && recentNotifications.length > 0) {
      console.log("Already sent delay notification recently, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Recent notification already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the new ETA for display
    const etaDate = new Date(newEta);
    const formattedEta = etaDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Build tracking URL if tracking token exists
    const trackingUrl = job.tracking_token
      ? `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/track/${job.tracking_token}`
      : null;

    const customerName = `${customer.first_name} ${customer.last_name}`;
    const businessName = business?.name || "Our Team";

    // Email subject and body
    const subject = `Update: Your appointment has been delayed`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Appointment Update</h2>
        <p>Hi ${customer.first_name},</p>
        <p>We wanted to let you know that your scheduled appointment has been delayed by approximately <strong>${delayMinutes} minutes</strong>.</p>
        <p><strong>New estimated arrival time:</strong> ${formattedEta}</p>
        <p><strong>Job:</strong> ${job.title || job.job_number}</p>
        ${trackingUrl ? `
        <p style="margin-top: 20px;">
          <a href="${trackingUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Track Technician Location
          </a>
        </p>
        ` : ""}
        <p style="margin-top: 20px; color: #6b7280;">We apologize for any inconvenience. If you have questions, please contact us.</p>
        <p>Thank you for your patience,<br/>${businessName}</p>
      </div>
    `;

    // Queue the email
    const { error: queueError } = await adminClient.from("email_queue").insert({
      business_id: job.business_id,
      to_email: customer.email,
      to_name: customerName,
      subject,
      body: htmlBody,
      template_type: "delay_notification",
      related_type: "job",
      related_id: jobId,
      status: "pending",
    });

    if (queueError) {
      console.error("Failed to queue email:", queueError);
      return new Response(JSON.stringify({ error: "Failed to queue notification" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If Resend is configured, send immediately
    if (resendApiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${businessName} <notifications@${business?.slug || "app"}.lovable.app>`,
            to: [customer.email],
            subject,
            html: htmlBody,
          }),
        });

        if (response.ok) {
          // Update queue status to sent
          await adminClient
            .from("email_queue")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("related_id", jobId)
            .eq("template_type", "delay_notification")
            .eq("status", "pending");

          console.log(`Delay notification sent to ${customer.email} for job ${jobId}`);
        }
      } catch (emailError) {
        console.error("Failed to send email via Resend:", emailError);
        // Email is still queued, so we don't fail the request
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: customer.email,
        delayMinutes,
        newEta: formattedEta,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Send delay notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
