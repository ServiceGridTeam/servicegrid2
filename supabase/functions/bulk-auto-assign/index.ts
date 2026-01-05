import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BulkAssignRequest {
  jobIds: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  balanceWorkload?: boolean;
  constraints?: {
    maxJobsPerWorker?: number;
    preferredWorkerIds?: string[];
  };
}

interface JobAssignment {
  jobId: string;
  userId: string;
  userName: string;
  scheduledStart: string;
  scheduledEnd: string;
  routePosition: number;
  reasoning: string;
}

interface UnassignedJob {
  jobId: string;
  jobNumber: string;
  reason: string;
}

interface BulkAssignResult {
  success: boolean;
  assignments: JobAssignment[];
  unassignedJobs: UnassignedJob[];
  routePlansCreated: string[];
  summary: {
    totalJobs: number;
    assigned: number;
    unassigned: number;
    workersUsed: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[bulk-auto-assign] No authorization header");
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use anon key with user's auth header for user context
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Service role client for privileged operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[bulk-auto-assign] Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[bulk-auto-assign] Authenticated user: ${user.id}`);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: "No business found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const businessId = profile.business_id;
    const body: BulkAssignRequest = await req.json();
    const { jobIds, dateRange, balanceWorkload = true, constraints = {} } = body;

    console.log(`[bulk-auto-assign] Processing ${jobIds.length} jobs for business ${businessId}`);

    if (!jobIds || jobIds.length === 0) {
      return new Response(JSON.stringify({ error: "No job IDs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch jobs with customer info
    const { data: jobs, error: jobsError } = await adminClient
      .from("jobs")
      .select(`
        *,
        customer:customers(first_name, last_name, latitude, longitude)
      `)
      .in("id", jobIds)
      .eq("business_id", businessId);

    if (jobsError || !jobs) {
      console.error("[bulk-auto-assign] Error fetching jobs:", jobsError);
      return new Response(JSON.stringify({ error: "Failed to fetch jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[bulk-auto-assign] Fetched ${jobs.length} jobs`);

    // Determine date range
    const startDate = dateRange?.start || new Date().toISOString().split("T")[0];
    const endDate = dateRange?.end || startDate;
    
    // Get all dates in range
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 1);
    }

    console.log(`[bulk-auto-assign] Date range: ${startDate} to ${endDate} (${dates.length} days)`);

    // Fetch available workers
    let workersQuery = adminClient
      .from("profiles")
      .select(`
        id, first_name, last_name, 
        max_daily_jobs, max_daily_hours,
        home_latitude, home_longitude
      `)
      .eq("business_id", businessId);

    if (constraints.preferredWorkerIds && constraints.preferredWorkerIds.length > 0) {
      workersQuery = workersQuery.in("id", constraints.preferredWorkerIds);
    }

    const { data: workers, error: workersError } = await workersQuery;

    if (workersError || !workers || workers.length === 0) {
      console.error("[bulk-auto-assign] Error fetching workers:", workersError);
      return new Response(JSON.stringify({ 
        success: false,
        assignments: [],
        unassignedJobs: jobs.map(j => ({ 
          jobId: j.id, 
          jobNumber: j.job_number,
          reason: "No workers available" 
        })),
        routePlansCreated: [],
        summary: {
          totalJobs: jobs.length,
          assigned: 0,
          unassigned: jobs.length,
          workersUsed: 0
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[bulk-auto-assign] Found ${workers.length} workers`);

    // Fetch time off for workers in date range
    const { data: timeOffRequests } = await adminClient
      .from("time_off_requests")
      .select("user_id, start_date, end_date")
      .eq("business_id", businessId)
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate);

    // Fetch team availability
    const { data: availability } = await adminClient
      .from("team_availability")
      .select("user_id, day_of_week, start_time, end_time, is_available")
      .eq("business_id", businessId)
      .in("user_id", workers.map(w => w.id));

    // Fetch existing job assignments to calculate current workload
    const { data: existingJobs } = await adminClient
      .from("jobs")
      .select("id, assigned_to, scheduled_start, estimated_duration_minutes")
      .eq("business_id", businessId)
      .in("status", ["scheduled", "in_progress"])
      .gte("scheduled_start", `${startDate}T00:00:00`)
      .lte("scheduled_start", `${endDate}T23:59:59`);

    // Build workload map per worker per date
    const workloadMap = new Map<string, Map<string, { jobCount: number; minutesUsed: number }>>();
    
    for (const worker of workers) {
      const workerMap = new Map<string, { jobCount: number; minutesUsed: number }>();
      for (const date of dates) {
        workerMap.set(date, { jobCount: 0, minutesUsed: 0 });
      }
      workloadMap.set(worker.id, workerMap);
    }

    // Populate existing workload
    if (existingJobs) {
      for (const job of existingJobs) {
        if (job.assigned_to && job.scheduled_start) {
          const jobDate = job.scheduled_start.split("T")[0];
          const workerLoad = workloadMap.get(job.assigned_to)?.get(jobDate);
          if (workerLoad) {
            workerLoad.jobCount++;
            workerLoad.minutesUsed += job.estimated_duration_minutes || 60;
          }
        }
      }
    }

    // Check if worker is available on a specific date
    function isWorkerAvailable(workerId: string, date: string): boolean {
      // Check time off
      if (timeOffRequests) {
        for (const req of timeOffRequests) {
          if (req.user_id === workerId) {
            const reqStart = new Date(req.start_date);
            const reqEnd = new Date(req.end_date);
            const checkDate = new Date(date);
            if (checkDate >= reqStart && checkDate <= reqEnd) {
              return false;
            }
          }
        }
      }

      // Check weekly schedule
      const dayOfWeek = new Date(date).getDay();
      const workerAvail = availability?.filter(a => 
        a.user_id === workerId && a.day_of_week === dayOfWeek
      );
      
      if (workerAvail && workerAvail.length > 0) {
        return workerAvail.some(a => a.is_available);
      }

      // Default to available if no schedule defined
      return true;
    }

    // Get worker capacity
    function getWorkerCapacity(workerId: string, date: string): { 
      canTakeMore: boolean; 
      remainingJobs: number;
      remainingMinutes: number 
    } {
      const worker = workers?.find(w => w.id === workerId);
      const maxJobs = constraints.maxJobsPerWorker || worker?.max_daily_jobs || 8;
      const maxMinutes = (worker?.max_daily_hours || 8) * 60;
      
      const currentLoad = workloadMap.get(workerId)?.get(date) || { jobCount: 0, minutesUsed: 0 };
      
      return {
        canTakeMore: currentLoad.jobCount < maxJobs && currentLoad.minutesUsed < maxMinutes,
        remainingJobs: maxJobs - currentLoad.jobCount,
        remainingMinutes: maxMinutes - currentLoad.minutesUsed
      };
    }

    // Calculate distance between two points
    function haversineDistance(
      lat1: number, lon1: number, 
      lat2: number, lon2: number
    ): number {
      const R = 6371; // km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    // Assign jobs
    const assignments: JobAssignment[] = [];
    const unassignedJobs: UnassignedJob[] = [];
    const routePlansCreated: string[] = [];
    const workersUsed = new Set<string>();

    // Sort jobs by priority and location clustering
    const sortedJobs = [...jobs].sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority || "normal"] || 2) - (priorityOrder[b.priority || "normal"] || 2);
    });

    for (const job of sortedJobs) {
      let assigned = false;
      let bestWorker: { id: string; name: string; date: string; score: number } | null = null;
      let bestScore = -Infinity;

      const jobLat = job.latitude || job.customer?.latitude;
      const jobLon = job.longitude || job.customer?.longitude;
      const jobDuration = job.estimated_duration_minutes || 60;

      // Find best worker for this job
      for (const date of dates) {
        for (const worker of workers) {
          if (!isWorkerAvailable(worker.id, date)) continue;
          
          const capacity = getWorkerCapacity(worker.id, date);
          if (!capacity.canTakeMore) continue;
          if (capacity.remainingMinutes < jobDuration) continue;

          // Calculate score
          let score = 100;

          // Distance score (closer is better)
          if (jobLat && jobLon && worker.home_latitude && worker.home_longitude) {
            const distance = haversineDistance(
              worker.home_latitude, worker.home_longitude,
              jobLat, jobLon
            );
            score -= Math.min(distance * 2, 50); // Max 50 point penalty for distance
          }

          // Workload balance score (prefer less loaded workers)
          if (balanceWorkload) {
            score += capacity.remainingJobs * 3;
          }

          // Preferred worker bonus
          if (constraints.preferredWorkerIds?.includes(worker.id)) {
            score += 20;
          }

          if (score > bestScore) {
            bestScore = score;
            bestWorker = {
              id: worker.id,
              name: `${worker.first_name || ""} ${worker.last_name || ""}`.trim() || "Worker",
              date,
              score
            };
          }
        }
      }

      if (bestWorker) {
        // Update workload tracking
        const workerLoad = workloadMap.get(bestWorker.id)?.get(bestWorker.date);
        if (workerLoad) {
          workerLoad.jobCount++;
          workerLoad.minutesUsed += jobDuration;
        }

        // Calculate scheduled time (simple approach: stack jobs starting at 8 AM)
        const existingJobsForWorkerDate = assignments.filter(
          a => a.userId === bestWorker!.id && a.scheduledStart.startsWith(bestWorker!.date)
        ).length;
        
        const baseHour = 8;
        const startHour = baseHour + existingJobsForWorkerDate;
        const scheduledStart = `${bestWorker.date}T${String(startHour).padStart(2, "0")}:00:00`;
        
        const endHour = startHour + Math.ceil(jobDuration / 60);
        const scheduledEnd = `${bestWorker.date}T${String(endHour).padStart(2, "0")}:00:00`;

        assignments.push({
          jobId: job.id,
          userId: bestWorker.id,
          userName: bestWorker.name,
          scheduledStart,
          scheduledEnd,
          routePosition: existingJobsForWorkerDate + 1,
          reasoning: `Assigned based on availability and ${balanceWorkload ? "workload balance" : "capacity"}`
        });

        workersUsed.add(bestWorker.id);
        assigned = true;

        console.log(`[bulk-auto-assign] Assigned job ${job.job_number} to ${bestWorker.name} on ${bestWorker.date}`);
      }

      if (!assigned) {
        unassignedJobs.push({
          jobId: job.id,
          jobNumber: job.job_number,
          reason: "No available workers with capacity in date range"
        });
        console.log(`[bulk-auto-assign] Could not assign job ${job.job_number}`);
      }
    }

    // Apply assignments to database
    for (const assignment of assignments) {
      // Update job
      await adminClient
        .from("jobs")
        .update({
          assigned_to: assignment.userId,
          scheduled_start: assignment.scheduledStart,
          scheduled_end: assignment.scheduledEnd,
          route_sequence: assignment.routePosition,
          auto_assigned: true,
          assignment_reasoning: assignment.reasoning,
          status: "scheduled"
        })
        .eq("id", assignment.jobId);

      // Create/update job assignment record
      await adminClient
        .from("job_assignments")
        .upsert({
          job_id: assignment.jobId,
          user_id: assignment.userId,
          business_id: businessId,
          role: "primary"
        }, { onConflict: "job_id,user_id" });
    }

    // Create/update route plans for each worker+date
    const workerDatePairs = new Map<string, string[]>();
    for (const assignment of assignments) {
      const date = assignment.scheduledStart.split("T")[0];
      const key = `${assignment.userId}|${date}`;
      if (!workerDatePairs.has(key)) {
        workerDatePairs.set(key, []);
      }
      workerDatePairs.get(key)!.push(assignment.jobId);
    }

    for (const [key, assignedJobIds] of workerDatePairs) {
      const [userId, routeDate] = key.split("|");
      
      const { data: routePlan } = await adminClient
        .from("daily_route_plans")
        .upsert({
          business_id: businessId,
          user_id: userId,
          route_date: routeDate,
          job_ids: assignedJobIds,
          status: "draft",
          optimization_reasoning: "Created via bulk auto-assign"
        }, { onConflict: "business_id,user_id,route_date" })
        .select("id")
        .single();

      if (routePlan) {
        routePlansCreated.push(routePlan.id);
      }
    }

    const result: BulkAssignResult = {
      success: true,
      assignments,
      unassignedJobs,
      routePlansCreated,
      summary: {
        totalJobs: jobs.length,
        assigned: assignments.length,
        unassigned: unassignedJobs.length,
        workersUsed: workersUsed.size
      }
    };

    console.log(`[bulk-auto-assign] Complete: ${assignments.length} assigned, ${unassignedJobs.length} unassigned`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[bulk-auto-assign] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
