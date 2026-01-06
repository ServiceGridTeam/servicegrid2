import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateRequest {
  jobId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  locationSource?: "gps" | "network" | "manual";
  eventType: "clock_in" | "clock_out";
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ValidateRequest = await req.json();
    const { jobId, location, locationSource = "gps", eventType } = body;

    console.log(`Validating ${eventType} for job ${jobId} at ${location.lat}, ${location.lng}`);

    // Get user's profile with name
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id, first_name, last_name")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(
        JSON.stringify({ error: "User not associated with a business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const workerName = profile.first_name && profile.last_name 
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "A worker";

    // Validate geofence using database function
    const { data: validation, error: validationError } = await supabase.rpc(
      "validate_geofence",
      {
        p_job_id: jobId,
        p_worker_lat: location.lat,
        p_worker_lng: location.lng,
      }
    );

    if (validationError) {
      console.error("Validation error:", validationError);
      return new Response(
        JSON.stringify({ error: "Failed to validate geofence" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (validation.error) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine status based on validation result
    let status: string;
    if (validation.within_geofence) {
      status = "success";
    } else if (validation.enforcement_mode === "warn") {
      status = "success"; // Allow but will create alert
    } else if (validation.enforcement_mode === "strict" && !validation.within_geofence) {
      status = "blocked";
    } else {
      status = "success";
    }

    // Create clock event record
    const { data: clockEvent, error: clockEventError } = await supabase
      .from("clock_events")
      .insert({
        business_id: profile.business_id,
        job_id: jobId,
        user_id: user.id,
        event_type: eventType,
        status,
        latitude: location.lat,
        longitude: location.lng,
        accuracy_meters: location.accuracy,
        location_source: locationSource,
        job_latitude: validation.job_latitude,
        job_longitude: validation.job_longitude,
        distance_from_job_meters: validation.distance_meters,
        geofence_radius_meters: validation.geofence_radius_meters,
        within_geofence: validation.within_geofence,
      })
      .select()
      .single();

    if (clockEventError) {
      console.error("Clock event error:", clockEventError);
      // Continue even if logging fails
    }

    // Create alert if outside geofence
    if (!validation.within_geofence && clockEvent) {
      const alertType = eventType === "clock_in" ? "clock_in_outside" : "clock_out_outside";
      
      await supabase.from("geofence_alerts").insert({
        business_id: profile.business_id,
        clock_event_id: clockEvent.id,
        job_id: jobId,
        user_id: user.id,
        alert_type: alertType,
        severity: validation.enforcement_mode === "strict" ? "error" : "warning",
        distance_meters: validation.distance_meters,
      });

      console.log(`Created geofence alert: ${alertType} at ${validation.distance_meters}m`);

      // Notify business team about geofence breach
      const eventLabel = eventType === "clock_in" ? "in" : "out";
      const distanceFeet = Math.round(validation.distance_meters * 3.28084);
      await notifyBusinessTeam(supabase, profile.business_id, {
        type: "geofence",
        title: "Geofence Alert",
        message: `${workerName} clocked ${eventLabel} ${distanceFeet}ft from job site`,
        data: {
          jobId,
          clockEventId: clockEvent.id,
          distance: validation.distance_meters,
          userId: user.id,
        },
      });
    }

    // Build response message
    let message: string;
    if (validation.within_geofence) {
      message = "You are within the job site geofence";
    } else {
      const distanceFeet = Math.round(validation.distance_meters * 3.28084);
      message = `You are ${distanceFeet} feet from the job site`;
    }

    const response = {
      allowed: status !== "blocked",
      within_geofence: validation.within_geofence,
      distance_meters: validation.distance_meters,
      distance_feet: Math.round(validation.distance_meters * 3.28084),
      geofence_radius_meters: validation.geofence_radius_meters,
      enforcement_mode: validation.enforcement_mode,
      can_override: validation.can_override,
      override_requires_reason: validation.override_requires_reason,
      override_requires_photo: validation.override_requires_photo,
      message,
      clock_event_id: clockEvent?.id,
    };

    console.log("Validation response:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in validate-clock-in:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
