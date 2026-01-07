import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckEligibilityRequest {
  jobId: string;
  businessId: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: CheckEligibilityRequest = await req.json();
    const { jobId, businessId } = body;

    console.log(`[check-review-eligibility] Checking job: ${jobId}`);

    // 1. Load review config for business
    const { data: config } = await supabase
      .from("review_configs")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (!config || !config.auto_request_enabled) {
      console.log("[check-review-eligibility] Auto-request disabled or no config");
      return successResponse({ eligible: false, reason: "auto_request_disabled" });
    }

    // 2. Load job with customer
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        customer_id,
        status,
        total_amount,
        completed_at,
        review_request_id,
        customer:customers(
          id,
          email,
          phone,
          review_opt_out,
          last_review_request_at,
          preferred_review_channel
        )
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("[check-review-eligibility] Job not found:", jobError);
      return successResponse({ eligible: false, reason: "job_not_found" });
    }

    // 3. Check if already has review request
    if (job.review_request_id) {
      console.log("[check-review-eligibility] Job already has review request");
      return successResponse({ eligible: false, reason: "already_requested" });
    }

    const customer = job.customer as any;
    if (!customer) {
      console.log("[check-review-eligibility] No customer found");
      return successResponse({ eligible: false, reason: "no_customer" });
    }

    // 4. Check customer opt-out
    if (customer.review_opt_out) {
      console.log("[check-review-eligibility] Customer opted out");
      return successResponse({ eligible: false, reason: "customer_opted_out" });
    }

    // 5. Check cooldown period
    if (customer.last_review_request_at) {
      const lastRequest = new Date(customer.last_review_request_at);
      const cooldownEnd = new Date(lastRequest.getTime() + config.cooldown_days * 24 * 60 * 60 * 1000);
      
      if (new Date() < cooldownEnd) {
        console.log("[check-review-eligibility] Customer in cooldown period");
        return successResponse({ eligible: false, reason: "in_cooldown" });
      }
    }

    // 6. Check minimum job value
    if (config.minimum_job_value && job.total_amount < config.minimum_job_value) {
      console.log("[check-review-eligibility] Job value below minimum");
      return successResponse({ eligible: false, reason: "below_minimum_value" });
    }

    // 7. Determine channel
    const hasEmail = !!customer.email;
    const hasPhone = !!customer.phone;
    let channel: "email" | "sms" = "email";

    if (config.request_channel === "sms" && config.sms_enabled && hasPhone) {
      channel = "sms";
    } else if (config.request_channel === "both") {
      // Prefer customer's preference, fallback to email
      if (customer.preferred_review_channel === "sms" && config.sms_enabled && hasPhone) {
        channel = "sms";
      } else if (hasEmail) {
        channel = "email";
      } else if (config.sms_enabled && hasPhone) {
        channel = "sms";
      }
    }

    if (channel === "email" && !hasEmail) {
      console.log("[check-review-eligibility] No email available");
      return successResponse({ eligible: false, reason: "no_email" });
    }

    if (channel === "sms" && !hasPhone) {
      console.log("[check-review-eligibility] No phone available");
      return successResponse({ eligible: false, reason: "no_phone" });
    }

    // 8. Calculate send time (delay + send window)
    const now = new Date();
    let scheduledSendAt = new Date(now.getTime() + config.delay_minutes * 60 * 1000);

    // Adjust for send window and timezone
    // TODO: Proper timezone handling with Intl
    const sendWindowStart = parseInt(config.send_window_start.split(":")[0]);
    const sendWindowEnd = parseInt(config.send_window_end.split(":")[0]);
    const scheduledHour = scheduledSendAt.getHours();

    if (scheduledHour < sendWindowStart) {
      scheduledSendAt.setHours(sendWindowStart, 0, 0, 0);
    } else if (scheduledHour >= sendWindowEnd) {
      // Move to next day
      scheduledSendAt.setDate(scheduledSendAt.getDate() + 1);
      scheduledSendAt.setHours(sendWindowStart, 0, 0, 0);
    }

    // Skip weekends if not allowed
    if (!config.send_on_weekends) {
      const day = scheduledSendAt.getDay();
      if (day === 0) scheduledSendAt.setDate(scheduledSendAt.getDate() + 1); // Sunday -> Monday
      if (day === 6) scheduledSendAt.setDate(scheduledSendAt.getDate() + 2); // Saturday -> Monday
    }

    // 9. Get assigned technician from job assignments
    const { data: assignment } = await supabase
      .from("job_assignments")
      .select("user_id")
      .eq("job_id", jobId)
      .eq("is_lead", true)
      .single();

    // 10. Create review request
    const tokenExpiresAt = new Date(scheduledSendAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextReminderAt = config.reminder_enabled
      ? new Date(scheduledSendAt.getTime() + config.reminder_delay_hours * 60 * 60 * 1000)
      : null;

    const { data: reviewRequest, error: insertError } = await supabase
      .from("review_requests")
      .insert({
        business_id: businessId,
        customer_id: customer.id,
        job_id: jobId,
        assigned_technician_id: assignment?.user_id || null,
        scheduled_send_at: scheduledSendAt.toISOString(),
        channel,
        status: "scheduled",
        token_expires_at: tokenExpiresAt.toISOString(),
        next_reminder_at: nextReminderAt?.toISOString() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[check-review-eligibility] Failed to create request:", insertError);
      return errorResponse("Failed to create review request", 500);
    }

    // 11. Update job with review request ID
    await supabase
      .from("jobs")
      .update({ 
        review_request_id: reviewRequest.id,
        review_requested_at: now.toISOString(),
      })
      .eq("id", jobId);

    // 12. Update customer's last review request timestamp
    await supabase
      .from("customers")
      .update({ last_review_request_at: now.toISOString() })
      .eq("id", customer.id);

    // 13. Update config stats
    await supabase
      .from("review_configs")
      .update({ 
        total_requests_sent: config.total_requests_sent + 1,
        updated_at: now.toISOString(),
      })
      .eq("id", config.id);

    console.log(`[check-review-eligibility] Created review request: ${reviewRequest.id}`);

    return successResponse({
      eligible: true,
      reviewRequestId: reviewRequest.id,
      scheduledSendAt: scheduledSendAt.toISOString(),
      channel,
    });
  } catch (error) {
    console.error("[check-review-eligibility] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});

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
