import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createNotification } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyJobAssignedRequest {
  jobId: string;
  assignedUserIds: string[];
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

    const body: NotifyJobAssignedRequest = await req.json();
    const { jobId, assignedUserIds, businessId } = body;

    console.log(`Sending assignment notifications for job: ${jobId} to users: ${assignedUserIds.join(", ")}`);

    if (!assignedUserIds.length) {
      return new Response(
        JSON.stringify({ success: true, notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch job info
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number, title")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Failed to fetch job:", jobError);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notify each assigned worker
    const results = { notified: 0, skipped: 0, failed: 0 };

    for (const userId of assignedUserIds) {
      const result = await createNotification(supabase, {
        userId,
        businessId,
        type: "job",
        title: "New Job Assignment",
        message: `You've been assigned to job: ${job.title}`,
        data: { jobId: job.id, jobNumber: job.job_number, jobTitle: job.title },
      });

      if (result.success && !result.skipped) results.notified++;
      else if (result.skipped) results.skipped++;
      else results.failed++;
    }

    console.log(`Assignment notification result: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-job-assigned:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
