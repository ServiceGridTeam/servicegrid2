import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createNotification, notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyJobStatusChangedRequest {
  jobId: string;
  oldStatus: string;
  newStatus: string;
  changedByUserId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: NotifyJobStatusChangedRequest = await req.json();
    const { jobId, oldStatus, newStatus, changedByUserId } = body;

    console.log(`Sending status change notification for job: ${jobId} (${oldStatus} -> ${newStatus})`);

    // Fetch job with assignments
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        business_id,
        assignments:job_assignments(user_id)
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Failed to fetch job:", jobError);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace(/_/g, " ");
    const results = { notified: 0, skipped: 0, failed: 0 };

    // Notify assigned workers (except the one who made the change)
    const assignments = job.assignments as { user_id: string }[] || [];
    for (const assignment of assignments) {
      if (assignment.user_id === changedByUserId) continue;

      const result = await createNotification(supabase, {
        userId: assignment.user_id,
        businessId: job.business_id,
        type: "job",
        title: "Job Status Updated",
        message: `Job ${job.job_number} status changed to ${statusLabel}`,
        data: { 
          jobId: job.id, 
          jobNumber: job.job_number, 
          oldStatus, 
          newStatus 
        },
      });

      if (result.success && !result.skipped) results.notified++;
      else if (result.skipped) results.skipped++;
      else results.failed++;
    }

    // For important statuses (completed, cancelled), notify the whole team
    const importantStatuses = ["completed", "cancelled"];
    if (importantStatuses.includes(newStatus)) {
      const teamResult = await notifyBusinessTeam(supabase, job.business_id, {
        type: "job",
        title: "Job Status Updated",
        message: `Job ${job.job_number} has been marked as ${statusLabel}`,
        data: { 
          jobId: job.id, 
          jobNumber: job.job_number, 
          oldStatus, 
          newStatus 
        },
      });

      results.notified += teamResult.notified;
      results.skipped += teamResult.skipped;
      results.failed += teamResult.failed;
    }

    console.log(`Status change notification result: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-job-status-changed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
