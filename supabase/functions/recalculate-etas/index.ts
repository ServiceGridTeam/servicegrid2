import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecalculateETAsRequest {
  routePlanId: string;
  completedJobId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleMapsKey = Deno.env.get("VITE_GOOGLE_MAPS_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { routePlanId, completedJobId } = (await req.json()) as RecalculateETAsRequest;

    console.log(`Recalculating ETAs for route plan: ${routePlanId}, completed job: ${completedJobId || "none"}`);

    // Get the route plan
    const { data: routePlan, error: planError } = await supabase
      .from("daily_route_plans")
      .select("*")
      .eq("id", routePlanId)
      .single();

    if (planError || !routePlan) {
      console.error("Route plan not found:", planError);
      return new Response(
        JSON.stringify({ error: "Route plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all jobs in this route
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .in("id", routePlan.job_ids)
      .order("route_sequence", { ascending: true });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No jobs in route" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the index of the completed job
    const completedIndex = completedJobId
      ? jobs.findIndex((j) => j.id === completedJobId)
      : -1;

    // Get remaining jobs (after completed one)
    const remainingJobs = completedIndex >= 0 ? jobs.slice(completedIndex + 1) : jobs;

    if (remainingJobs.length === 0) {
      console.log("No remaining jobs to recalculate");
      return new Response(
        JSON.stringify({ message: "All jobs completed", updatedCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Current time as the new baseline
    const now = new Date();
    let currentTime = now;

    // Get user's current location or use completed job's location as starting point
    let startLat: number | null = null;
    let startLng: number | null = null;

    if (completedIndex >= 0 && jobs[completedIndex]) {
      startLat = jobs[completedIndex].latitude;
      startLng = jobs[completedIndex].longitude;
    } else if (routePlan.start_location) {
      const startLoc = routePlan.start_location as { lat: number; lng: number };
      startLat = startLoc.lat;
      startLng = startLoc.lng;
    }

    const updatedJobs: { id: string; estimated_arrival: string; drive_time_from_previous: number }[] = [];

    // Calculate new ETAs for remaining jobs
    for (let i = 0; i < remainingJobs.length; i++) {
      const job = remainingJobs[i];
      let driveTime = 15 * 60; // Default 15 minutes if we can't calculate

      // Try to get actual drive time from Google Maps
      if (googleMapsKey && startLat && startLng && job.latitude && job.longitude) {
        try {
          const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${job.latitude},${job.longitude}&key=${googleMapsKey}`;
          const response = await fetch(directionsUrl);
          const data = await response.json();

          if (data.status === "OK" && data.routes?.[0]?.legs?.[0]) {
            driveTime = data.routes[0].legs[0].duration.value; // in seconds
          }
        } catch (err) {
          console.error("Error fetching directions:", err);
        }
      }

      // Add drive time to current time
      currentTime = new Date(currentTime.getTime() + driveTime * 1000);

      updatedJobs.push({
        id: job.id,
        estimated_arrival: currentTime.toISOString(),
        drive_time_from_previous: Math.round(driveTime / 60), // Convert to minutes
      });

      // Add job duration for next calculation
      const jobDuration = job.estimated_duration_minutes || 60;
      currentTime = new Date(currentTime.getTime() + jobDuration * 60 * 1000);

      // Update start point for next iteration
      startLat = job.latitude;
      startLng = job.longitude;
    }

    // Update jobs in database
    for (const update of updatedJobs) {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          estimated_arrival: update.estimated_arrival,
          drive_time_from_previous: update.drive_time_from_previous,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error(`Error updating job ${update.id}:`, updateError);
      }
    }

    // Check if any job is significantly delayed (> 15 min from original ETA)
    const significantDelays = [];
    for (const job of jobs) {
      if (job.scheduled_start && job.estimated_arrival) {
        const scheduled = new Date(job.scheduled_start);
        const estimated = new Date(job.estimated_arrival);
        const delayMinutes = (estimated.getTime() - scheduled.getTime()) / (60 * 1000);

        if (delayMinutes > 15) {
          significantDelays.push({
            jobId: job.id,
            jobNumber: job.job_number,
            delayMinutes: Math.round(delayMinutes),
          });
        }
      }
    }

    console.log(`Updated ${updatedJobs.length} job ETAs, ${significantDelays.length} significant delays`);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: updatedJobs.length,
        significantDelays,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error recalculating ETAs:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
