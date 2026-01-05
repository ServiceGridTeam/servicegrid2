import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutoAssignRequest {
  jobId: string;
  preferredDate?: string;
  preferredWorkerId?: string;
}

interface WorkerScore {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  fitScore: number;
  existingJobs: number;
  maxDailyJobs: number;
  maxDailyHours: number;
  availableMinutes: number;
  distanceScore: number;
  capacityScore: number;
  homeLatitude?: number;
  homeLongitude?: number;
}

interface AssignmentResult {
  success: boolean;
  assignment?: {
    userId: string;
    userName: string;
    scheduledStart: string;
    scheduledEnd: string;
    routePosition: number;
  };
  reasoning: string;
  alternatives: {
    userId: string;
    userName: string;
    fitScore: number;
    reason: string;
  }[];
  routePlanId?: string;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AutoAssignRequest = await req.json();
    const { jobId, preferredDate, preferredWorkerId } = body;

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "jobId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Auto-assign request for job ${jobId}, date: ${preferredDate || 'auto'}`);

    // 1. FETCH JOB with customer details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select(`
        *,
        customer:customers(*)
      `)
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      console.error("Job fetch error:", jobError);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if job has an address
    if (!job.address_line1 && !job.latitude) {
      return new Response(
        JSON.stringify({ error: "Job needs an address before it can be auto-assigned" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target date (tomorrow if not specified)
    const targetDate = preferredDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const targetDateObj = new Date(targetDate);
    const dayOfWeek = targetDateObj.getDay();

    console.log(`Target date: ${targetDate}, day of week: ${dayOfWeek}`);

    // 2. GET AVAILABLE WORKERS for target date
    // Fetch team members with availability
    const { data: teamMembers, error: teamError } = await supabase
      .from("profiles")
      .select("*")
      .eq("business_id", job.business_id);

    if (teamError) {
      console.error("Team fetch error:", teamError);
      throw teamError;
    }

    if (!teamMembers || teamMembers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No team members available",
          reasoning: "No team members are configured for this business.",
          alternatives: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get availability records for the target day
    const { data: availabilityRecords } = await supabase
      .from("team_availability")
      .select("*")
      .eq("business_id", job.business_id)
      .eq("day_of_week", dayOfWeek);

    // Get time off requests that overlap target date
    const { data: timeOffRequests } = await supabase
      .from("time_off_requests")
      .select("*")
      .eq("business_id", job.business_id)
      .eq("status", "approved")
      .lte("start_date", targetDate)
      .gte("end_date", targetDate);

    const timeOffUserIds = new Set((timeOffRequests || []).map(r => r.user_id));

    // Build availability map
    const availabilityMap = new Map<string, { startTime: string; endTime: string; isAvailable: boolean }>();
    for (const record of availabilityRecords || []) {
      availabilityMap.set(record.user_id, {
        startTime: record.start_time,
        endTime: record.end_time,
        isAvailable: record.is_available
      });
    }

    // 3. GET EXISTING WORKLOADS for target date
    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("id, assigned_to, scheduled_start, scheduled_end, estimated_duration_minutes")
      .eq("business_id", job.business_id)
      .gte("scheduled_start", startOfDay)
      .lte("scheduled_start", endOfDay)
      .not("status", "eq", "cancelled");

    // Count jobs per worker
    const jobCountMap = new Map<string, number>();
    const jobTimeMap = new Map<string, number>();
    for (const existingJob of existingJobs || []) {
      if (existingJob.assigned_to) {
        jobCountMap.set(existingJob.assigned_to, (jobCountMap.get(existingJob.assigned_to) || 0) + 1);
        const duration = existingJob.estimated_duration_minutes || 60;
        jobTimeMap.set(existingJob.assigned_to, (jobTimeMap.get(existingJob.assigned_to) || 0) + duration);
      }
    }

    // 4. SCORE EACH WORKER
    const scoredWorkers: WorkerScore[] = [];
    const jobDuration = job.estimated_duration_minutes || 60;

    for (const worker of teamMembers) {
      // Skip workers on time off
      if (timeOffUserIds.has(worker.id)) {
        console.log(`Worker ${worker.first_name} ${worker.last_name} is on time off`);
        continue;
      }

      // Check availability (default to available Mon-Fri if no record)
      const availability = availabilityMap.get(worker.id);
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      const isAvailable = availability ? availability.isAvailable : isWeekday;
      
      if (!isAvailable) {
        console.log(`Worker ${worker.first_name} ${worker.last_name} not available on this day`);
        continue;
      }

      const existingJobCount = jobCountMap.get(worker.id) || 0;
      const existingJobTime = jobTimeMap.get(worker.id) || 0;
      const maxJobs = worker.max_daily_jobs || 8;
      const maxHours = worker.max_daily_hours || 8;
      const maxMinutes = maxHours * 60;

      // Skip if at capacity
      if (existingJobCount >= maxJobs) {
        console.log(`Worker ${worker.first_name} ${worker.last_name} at job capacity (${existingJobCount}/${maxJobs})`);
        continue;
      }

      if (existingJobTime + jobDuration > maxMinutes) {
        console.log(`Worker ${worker.first_name} ${worker.last_name} at time capacity`);
        continue;
      }

      // Calculate scores (0-1 scale)
      const capacityScore = 1 - (existingJobCount / maxJobs);
      
      // Distance score (simplified without actual geocoding)
      // If we have coordinates, use simple Euclidean distance
      let distanceScore = 0.5; // Default middle score
      if (worker.home_latitude && worker.home_longitude && job.latitude && job.longitude) {
        const latDiff = Math.abs(worker.home_latitude - job.latitude);
        const lngDiff = Math.abs(worker.home_longitude - job.longitude);
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        // Rough conversion: 1 degree ≈ 69 miles
        const miles = distance * 69;
        distanceScore = Math.max(0, 1 - (miles / 50)); // 0 at 50+ miles, 1 at 0 miles
      }

      // Preference boost
      let preferenceBoost = 0;
      if (preferredWorkerId && worker.id === preferredWorkerId) {
        preferenceBoost = 0.2;
      }

      // Combined score
      const fitScore = (distanceScore * 0.4) + (capacityScore * 0.5) + preferenceBoost + 0.1;

      scoredWorkers.push({
        userId: worker.id,
        firstName: worker.first_name || "",
        lastName: worker.last_name || "",
        email: worker.email || "",
        fitScore: Math.min(1, fitScore),
        existingJobs: existingJobCount,
        maxDailyJobs: maxJobs,
        maxDailyHours: maxHours,
        availableMinutes: maxMinutes - existingJobTime,
        distanceScore,
        capacityScore,
        homeLatitude: worker.home_latitude,
        homeLongitude: worker.home_longitude
      });
    }

    // Sort by fit score descending
    scoredWorkers.sort((a, b) => b.fitScore - a.fitScore);

    console.log(`Found ${scoredWorkers.length} available workers after filtering`);

    if (scoredWorkers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No available workers",
          reasoning: "No team members are available on this date. They may be on time off, at capacity, or not scheduled to work.",
          alternatives: []
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. CALL LOVABLE AI for intelligent decision
    const topWorkers = scoredWorkers.slice(0, 3);
    const workerContext = topWorkers.map(w => 
      `- ${w.firstName} ${w.lastName}: Fit score ${(w.fitScore * 100).toFixed(0)}%, ${w.existingJobs} jobs today (max ${w.maxDailyJobs}), ${Math.round(w.availableMinutes / 60)}h available`
    ).join('\n');

    const customerPrefs = job.customer?.preferred_schedule_days 
      ? `Customer prefers: ${job.customer.preferred_schedule_days.join(', ')}`
      : 'No customer preferences specified';

    const aiPrompt = `You are a field service scheduling assistant. Select the best worker for this job and explain why.

Job: ${job.title || job.job_number}
Location: ${job.address_line1 || 'Address on file'}, ${job.city || ''} ${job.state || ''}
Duration: ${jobDuration} minutes
${customerPrefs}

Available workers (ranked by fit):
${workerContext}

Respond ONLY with valid JSON (no markdown):
{"selectedWorkerId": "uuid", "reasoning": "2-3 sentence explanation of why this worker is the best choice"}`;

    console.log("Calling Lovable AI for decision...");

    let selectedWorker = topWorkers[0];
    let reasoning = `${selectedWorker.firstName} ${selectedWorker.lastName} was selected based on availability and workload balance.`;

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: aiPrompt }]
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        console.log("AI response:", content);
        
        // Parse AI response
        try {
          // Clean up markdown code blocks if present
          const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleanedContent);
          if (parsed.selectedWorkerId && parsed.reasoning) {
            const aiSelectedWorker = scoredWorkers.find(w => w.userId === parsed.selectedWorkerId);
            if (aiSelectedWorker) {
              selectedWorker = aiSelectedWorker;
              reasoning = parsed.reasoning;
            } else {
              reasoning = parsed.reasoning || reasoning;
            }
          }
        } catch (parseError) {
          console.log("Could not parse AI response, using default selection");
        }
      } else {
        console.error("AI request failed:", await aiResponse.text());
      }
    } catch (aiError) {
      console.error("AI call error:", aiError);
      // Continue with rule-based selection
    }

    // 6. DETERMINE TIME SLOT
    // Find the first available slot based on worker's schedule
    const availability = availabilityMap.get(selectedWorker.userId);
    const startTime = availability?.startTime || "08:00:00";
    
    // Get worker's existing jobs to find next available slot
    const workerJobs = (existingJobs || [])
      .filter(j => j.assigned_to === selectedWorker.userId)
      .sort((a, b) => new Date(a.scheduled_start!).getTime() - new Date(b.scheduled_start!).getTime());

    let scheduledStart: Date;
    if (workerJobs.length === 0) {
      // Start at beginning of workday
      scheduledStart = new Date(`${targetDate}T${startTime}`);
    } else {
      // Start after last job ends
      const lastJob = workerJobs[workerJobs.length - 1];
      scheduledStart = new Date(lastJob.scheduled_end || lastJob.scheduled_start!);
      scheduledStart.setMinutes(scheduledStart.getMinutes() + 15); // 15 min buffer
    }

    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setMinutes(scheduledEnd.getMinutes() + jobDuration);

    // 7. CREATE ASSIGNMENT
    console.log(`Assigning job to ${selectedWorker.firstName} ${selectedWorker.lastName}`);
    
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        assigned_to: selectedWorker.userId,
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        auto_assigned: true,
        assignment_reasoning: reasoning,
        status: "scheduled"
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Job update error:", updateError);
      throw updateError;
    }

    // Create job_assignments record
    const { error: assignmentError } = await supabase
      .from("job_assignments")
      .upsert({
        job_id: jobId,
        user_id: selectedWorker.userId,
        business_id: job.business_id,
        role: "lead"
      }, { onConflict: "job_id,user_id" });

    if (assignmentError) {
      console.error("Assignment insert error:", assignmentError);
      // Non-fatal, continue
    }

    // 8. GET OR CREATE ROUTE PLAN
    let routePlanId: string | undefined;
    
    // Check for existing route plan
    const { data: existingPlan } = await supabase
      .from("daily_route_plans")
      .select("*")
      .eq("user_id", selectedWorker.userId)
      .eq("route_date", targetDate)
      .single();

    if (existingPlan) {
      // Add job to existing plan
      const newJobIds = [...(existingPlan.job_ids || []), jobId];
      await supabase
        .from("daily_route_plans")
        .update({ job_ids: newJobIds })
        .eq("id", existingPlan.id);
      routePlanId = existingPlan.id;
    } else {
      // Create new route plan
      const { data: newPlan } = await supabase
        .from("daily_route_plans")
        .insert({
          business_id: job.business_id,
          user_id: selectedWorker.userId,
          route_date: targetDate,
          job_ids: [jobId],
          status: "draft"
        })
        .select()
        .single();
      routePlanId = newPlan?.id;
    }

    // Update job with route plan reference
    if (routePlanId) {
      await supabase
        .from("jobs")
        .update({ route_plan_id: routePlanId })
        .eq("id", jobId);
    }

    // Build alternatives list
    const alternatives = topWorkers
      .filter(w => w.userId !== selectedWorker.userId)
      .map(w => ({
        userId: w.userId,
        userName: `${w.firstName} ${w.lastName}`,
        fitScore: w.fitScore,
        reason: w.existingJobs === 0 
          ? "Currently has no jobs scheduled" 
          : `Has ${w.existingJobs} job(s) already scheduled`
      }));

    const result: AssignmentResult = {
      success: true,
      assignment: {
        userId: selectedWorker.userId,
        userName: `${selectedWorker.firstName} ${selectedWorker.lastName}`,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        routePosition: workerJobs.length + 1
      },
      reasoning,
      alternatives,
      routePlanId
    };

    console.log("Auto-assignment complete:", result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Auto-assign error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Internal server error", 
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
