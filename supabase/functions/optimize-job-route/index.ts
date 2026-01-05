import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RouteOptimizationRequest {
  userId: string;
  date: string; // YYYY-MM-DD
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
}

interface RouteLeg {
  from: string;
  to: string;
  distanceMeters: number;
  durationSeconds: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleMapsApiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RouteOptimizationRequest = await req.json();
    const { userId, date, startLocation, endLocation } = body;

    console.log(`Optimizing route for user ${userId} on ${date}`);

    // Fetch jobs for the user on the specified date
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, title, latitude, longitude, address_line1, city, state, estimated_duration_minutes, scheduled_start")
      .eq("assigned_to", userId)
      .gte("scheduled_start", startOfDay)
      .lte("scheduled_start", endOfDay)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("scheduled_start", { ascending: true });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw jobsError;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No jobs with coordinates found for optimization");
      return new Response(
        JSON.stringify({
          optimizedJobIds: [],
          totalDistanceMeters: 0,
          totalDurationSeconds: 0,
          legs: [],
          overviewPolyline: null,
          message: "No jobs with coordinates found for the specified date",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${jobs.length} jobs with coordinates`);

    // Get user's home location if start/end not provided
    let origin = startLocation;
    let destination = endLocation;

    if (!origin || !destination) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_latitude, home_longitude")
        .eq("id", userId)
        .single();

      if (profile?.home_latitude && profile?.home_longitude) {
        origin = origin || { lat: profile.home_latitude, lng: profile.home_longitude };
        destination = destination || { lat: profile.home_latitude, lng: profile.home_longitude };
      }
    }

    // Build waypoints for Google Directions API
    const waypoints = jobs.map((job) => `${job.latitude},${job.longitude}`);

    // If we have origin/destination, use them; otherwise use first/last job
    const originStr = origin 
      ? `${origin.lat},${origin.lng}` 
      : waypoints[0];
    const destinationStr = destination 
      ? `${destination.lat},${destination.lng}` 
      : waypoints[waypoints.length - 1];

    // Remove origin/destination from waypoints if they match
    let intermediateWaypoints = waypoints;
    if (!origin) {
      intermediateWaypoints = waypoints.slice(1);
    }
    if (!destination && intermediateWaypoints.length > 0) {
      intermediateWaypoints = intermediateWaypoints.slice(0, -1);
    }

    // Build Directions API URL
    let directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destinationStr}&key=${googleMapsApiKey}`;

    if (intermediateWaypoints.length > 0) {
      // Use optimize:true to reorder waypoints for efficiency
      directionsUrl += `&waypoints=optimize:true|${intermediateWaypoints.join("|")}`;
    }

    console.log("Calling Google Directions API...");
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    if (directionsData.status !== "OK") {
      console.error("Directions API error:", directionsData.status, directionsData.error_message);
      throw new Error(`Directions API error: ${directionsData.status} - ${directionsData.error_message || ""}`);
    }

    const route = directionsData.routes[0];
    const waypointOrder = route.waypoint_order || [];

    // Map optimized order back to jobs
    // If we have intermediate waypoints, waypointOrder gives us the optimized order
    // Otherwise, jobs are already in order
    let optimizedJobs = jobs;
    if (waypointOrder.length > 0 && intermediateWaypoints.length > 0) {
      // Reorder jobs based on waypoint_order
      // waypointOrder refers to intermediate waypoints indices
      const jobsToOptimize = origin ? jobs : jobs.slice(1);
      const optimizedMiddle = waypointOrder.map((i: number) => jobsToOptimize[i]);
      
      if (!origin) {
        optimizedJobs = [jobs[0], ...optimizedMiddle];
      } else {
        optimizedJobs = optimizedMiddle;
      }
      if (!destination && jobs.length > 0) {
        // Last job stays at end if it was destination
      }
    }

    // Calculate legs and totals
    const legs: RouteLeg[] = [];
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    for (const leg of route.legs) {
      legs.push({
        from: leg.start_address,
        to: leg.end_address,
        distanceMeters: leg.distance.value,
        durationSeconds: leg.duration.value,
      });
      totalDistanceMeters += leg.distance.value;
      totalDurationSeconds += leg.duration.value;
    }

    const overviewPolyline = route.overview_polyline?.points || null;

    // Get or create daily route plan
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", userId)
      .single();

    if (!profile?.business_id) {
      throw new Error("User has no business_id");
    }

    // Upsert route plan
    const optimizedJobIds = optimizedJobs.map((j) => j.id);
    const optimizedSequence = optimizedJobs.map((_, i) => i + 1);

    const { data: routePlan, error: routePlanError } = await supabase
      .from("daily_route_plans")
      .upsert(
        {
          user_id: userId,
          business_id: profile.business_id,
          route_date: date,
          job_ids: optimizedJobIds,
          optimized_sequence: optimizedSequence,
          total_distance_meters: totalDistanceMeters,
          total_duration_seconds: totalDurationSeconds,
          overview_polyline: overviewPolyline,
          legs: legs,
          start_location: origin || null,
          end_location: destination || null,
          status: "optimized",
          optimization_reasoning: `Route optimized using Google Maps Directions API. ${optimizedJobs.length} stops, ${Math.round(totalDistanceMeters / 1609.34)} miles, ${Math.round(totalDurationSeconds / 60)} minutes drive time.`,
        },
        { onConflict: "business_id,user_id,route_date" }
      )
      .select()
      .single();

    if (routePlanError) {
      console.error("Error saving route plan:", routePlanError);
      throw routePlanError;
    }

    // Update jobs with route sequence and estimated arrivals
    let accumulatedDriveTime = 0;
    const baseTime = new Date(`${date}T08:00:00`); // Default start at 8 AM

    for (let i = 0; i < optimizedJobs.length; i++) {
      const job = optimizedJobs[i];
      const legDuration = i < legs.length ? legs[i].durationSeconds : 0;
      
      // Estimated arrival = base time + accumulated drive time + previous job durations
      const previousJobsDuration = optimizedJobs
        .slice(0, i)
        .reduce((sum, j) => sum + (j.estimated_duration_minutes || 60), 0) * 60;
      
      const estimatedArrivalTime = new Date(
        baseTime.getTime() + (accumulatedDriveTime + previousJobsDuration) * 1000
      );

      await supabase
        .from("jobs")
        .update({
          route_plan_id: routePlan.id,
          route_sequence: i + 1,
          estimated_arrival: estimatedArrivalTime.toISOString(),
          drive_time_from_previous: i > 0 ? Math.round(legs[i - 1]?.durationSeconds / 60) : null,
        })
        .eq("id", job.id);

      accumulatedDriveTime += legDuration;
    }

    console.log(`Route optimization complete: ${optimizedJobs.length} jobs, ${Math.round(totalDistanceMeters / 1000)} km`);

    return new Response(
      JSON.stringify({
        routePlanId: routePlan.id,
        optimizedJobIds,
        totalDistanceMeters,
        totalDurationSeconds,
        legs,
        overviewPolyline,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to optimize route";
    console.error("Error optimizing route:", error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
