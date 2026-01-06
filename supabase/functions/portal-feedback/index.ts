import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
};

interface ActionRequest {
  action: string;
  jobId?: string;
  customerId?: string;
  rating?: number;
  comment?: string;
  technicianRating?: number;
  timelinessRating?: number;
  qualityRating?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session
    const sessionToken = req.headers.get("x-portal-session");
    if (!sessionToken) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: session, error: sessionError } = await supabase
      .from("customer_portal_sessions")
      .select("customer_account_id, active_business_id, active_customer_id")
      .eq("token", sessionToken)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return errorResponse("Invalid or expired session", 401);
    }

    const body: ActionRequest = await req.json();
    const { action } = body;

    console.log(`[portal-feedback] Action: ${action}`);

    switch (action) {
      case "submit":
        return await handleSubmit(supabase, session, body);
      case "get-pending":
        return await handleGetPending(supabase, session);
      case "get-history":
        return await handleGetHistory(supabase, session);
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error: unknown) {
    console.error("[portal-feedback] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleSubmit(supabase: any, session: any, body: ActionRequest) {
  const { jobId, rating, comment, technicianRating, timelinessRating, qualityRating } = body;

  if (!jobId || !rating) {
    return errorResponse("Job ID and rating are required", 400);
  }

  // Verify job belongs to customer and is completed
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, title, status")
    .eq("id", jobId)
    .eq("customer_id", session.active_customer_id)
    .eq("status", "Completed")
    .single();

  if (jobError || !job) {
    return errorResponse("Job not found or not completed", 404);
  }

  // Check if feedback already exists
  const { data: existingFeedback } = await supabase
    .from("customer_feedback")
    .select("id")
    .eq("job_id", jobId)
    .eq("customer_id", session.active_customer_id)
    .single();

  if (existingFeedback) {
    return errorResponse("Feedback already submitted for this job", 400);
  }

  // Insert feedback
  const { data: feedback, error } = await supabase
    .from("customer_feedback")
    .insert({
      business_id: session.active_business_id,
      customer_id: session.active_customer_id,
      job_id: jobId,
      rating,
      comment: comment || null,
      technician_rating: technicianRating || null,
      timeliness_rating: timelinessRating || null,
      quality_rating: qualityRating || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[portal-feedback] Submit error:", error);
    return errorResponse("Failed to submit feedback", 500);
  }

  // Log activity
  await supabase.from("portal_activity_log").insert({
    customer_account_id: session.customer_account_id,
    business_id: session.active_business_id,
    activity_type: "feedback_submitted",
    entity_type: "feedback",
    entity_id: feedback.id,
    metadata: { jobId, rating },
  });

  console.log(`[portal-feedback] Feedback submitted for job: ${jobId}`);

  return successResponse({ success: true, feedbackId: feedback.id });
}

async function handleGetPending(supabase: any, session: any) {
  // Get completed jobs without feedback
  const { data: jobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, completed_at, status")
    .eq("customer_id", session.active_customer_id)
    .eq("business_id", session.active_business_id)
    .eq("status", "Completed")
    .order("completed_at", { ascending: false });

  if (jobsError) {
    console.error("[portal-feedback] Get pending error:", jobsError);
    return errorResponse("Failed to fetch jobs", 500);
  }

  // Get jobs that already have feedback
  const { data: existingFeedback } = await supabase
    .from("customer_feedback")
    .select("job_id")
    .eq("customer_id", session.active_customer_id);

  const feedbackJobIds = new Set(existingFeedback?.map((f: any) => f.job_id) || []);

  // Filter to jobs without feedback
  const pendingJobs = (jobs || [])
    .filter((job: any) => !feedbackJobIds.has(job.id))
    .map((job: any) => ({
      jobId: job.id,
      jobTitle: job.title,
      completedAt: job.completed_at,
    }));

  return successResponse({ pendingJobs });
}

async function handleGetHistory(supabase: any, session: any) {
  const { data: feedback, error } = await supabase
    .from("customer_feedback")
    .select("*, jobs(title)")
    .eq("customer_id", session.active_customer_id)
    .eq("business_id", session.active_business_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[portal-feedback] Get history error:", error);
    return errorResponse("Failed to fetch feedback history", 500);
  }

  return successResponse({ feedback });
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
