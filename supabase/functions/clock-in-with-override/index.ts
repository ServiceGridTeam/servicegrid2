import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverrideRequest {
  jobId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  reason: string;
  photoBase64?: string;
  eventType: "clock_in" | "clock_out";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
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

    const body: OverrideRequest = await req.json();
    const { jobId, location, reason, photoBase64, eventType } = body;

    console.log(`Processing ${eventType} override for job ${jobId}`);

    // Get user's profile and business
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

    // Get business settings to check if override is allowed
    const { data: business } = await supabase
      .from("businesses")
      .select("geofence_allow_override, geofence_override_requires_reason, geofence_override_requires_photo")
      .eq("id", profile.business_id)
      .single();

    if (!business?.geofence_allow_override) {
      return new Response(
        JSON.stringify({ error: "Override is not allowed for this business" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (business.geofence_override_requires_reason && !reason) {
      return new Response(
        JSON.stringify({ error: "A reason is required for override" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get job details
    const { data: job } = await supabase
      .from("jobs")
      .select("latitude, longitude")
      .eq("id", jobId)
      .single();

    // Calculate distance
    let distanceMeters = 0;
    if (job?.latitude && job?.longitude) {
      const { data: distance } = await supabase.rpc("calculate_distance_meters", {
        lat1: location.lat,
        lng1: location.lng,
        lat2: job.latitude,
        lng2: job.longitude,
      });
      distanceMeters = distance || 0;
    }

    // Handle photo upload if provided
    let photoUrl: string | null = null;
    if (photoBase64) {
      const fileName = `${profile.business_id}/${jobId}/${Date.now()}.jpg`;
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from("override-photos")
        .upload(fileName, binaryData, {
          contentType: "image/jpeg",
        });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("override-photos")
          .getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
    }

    // Create clock event with override
    const { data: clockEvent, error: clockEventError } = await supabase
      .from("clock_events")
      .insert({
        business_id: profile.business_id,
        job_id: jobId,
        user_id: user.id,
        event_type: eventType,
        status: "override",
        latitude: location.lat,
        longitude: location.lng,
        accuracy_meters: location.accuracy,
        location_source: "gps",
        job_latitude: job?.latitude,
        job_longitude: job?.longitude,
        distance_from_job_meters: distanceMeters,
        within_geofence: false,
        override_reason: reason,
        override_photo_url: photoUrl,
      })
      .select()
      .single();

    if (clockEventError) {
      console.error("Clock event error:", clockEventError);
      return new Response(
        JSON.stringify({ error: "Failed to record clock event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create alert for override
    const { data: alert } = await supabase
      .from("geofence_alerts")
      .insert({
        business_id: profile.business_id,
        clock_event_id: clockEvent.id,
        job_id: jobId,
        user_id: user.id,
        alert_type: "override_requested",
        severity: "info",
        distance_meters: distanceMeters,
      })
      .select()
      .single();

    // Notify business team about the override
    const workerName = profile.first_name && profile.last_name 
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "A worker";
    const eventLabel = eventType === "clock_in" ? "in" : "out";
    const distanceFeet = Math.round(distanceMeters * 3.28084);
    
    await notifyBusinessTeam(supabase, profile.business_id, {
      type: "geofence",
      title: "Geofence Override",
      message: `${workerName} clocked ${eventLabel} with override (${distanceFeet}ft from site)`,
      data: {
        jobId,
        clockEventId: clockEvent.id,
        alertId: alert?.id,
        distance: distanceMeters,
        reason,
        userId: user.id,
      },
    });

    // Create or update time_entry to link with clock_event
    let timeEntryId: string | null = null;
    
    if (eventType === "clock_in") {
      // Create a new time entry for clock in
      const { data: timeEntry, error: timeEntryError } = await supabase
        .from("time_entries")
        .insert({
          business_id: profile.business_id,
          job_id: jobId,
          user_id: user.id,
          entry_type: "work",
          clock_in: new Date().toISOString(),
          clock_in_latitude: location.lat,
          clock_in_longitude: location.lng,
          location_accuracy: location.accuracy,
          clock_in_event_id: clockEvent.id,
        })
        .select()
        .single();

      if (timeEntryError) {
        console.error("Time entry creation error:", timeEntryError);
      } else {
        timeEntryId = timeEntry.id;
      }
    } else if (eventType === "clock_out") {
      // Find active time entry and update it
      const { data: activeEntry } = await supabase
        .from("time_entries")
        .select("id, clock_in")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeEntry) {
        const clockIn = new Date(activeEntry.clock_in);
        const clockOut = new Date();
        const durationMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);

        const { error: updateError } = await supabase
          .from("time_entries")
          .update({
            clock_out: clockOut.toISOString(),
            duration_minutes: durationMinutes,
            clock_out_latitude: location.lat,
            clock_out_longitude: location.lng,
            clock_out_event_id: clockEvent.id,
          })
          .eq("id", activeEntry.id);

        if (updateError) {
          console.error("Time entry update error:", updateError);
        } else {
          timeEntryId = activeEntry.id;
        }
      } else {
        console.warn("No active time entry found for clock out override");
      }
    }

    // Update job clock fields
    const jobUpdate = eventType === "clock_in"
      ? {
          is_clocked_in: true,
          clock_in_time: new Date().toISOString(),
          clock_in_location_lat: location.lat,
          clock_in_location_lng: location.lng,
          clock_in_distance_meters: distanceMeters,
          clock_in_override: true,
        }
      : {
          is_clocked_in: false,
          clock_out_time: new Date().toISOString(),
          clock_out_location_lat: location.lat,
          clock_out_location_lng: location.lng,
          clock_out_distance_meters: distanceMeters,
          clock_out_override: true,
        };

    await supabase.from("jobs").update(jobUpdate).eq("id", jobId);

    // Update or create worker status
    await supabase
      .from("worker_statuses")
      .upsert({
        business_id: profile.business_id,
        user_id: user.id,
        current_status: eventType === "clock_in" ? "on_site" : "off_duty",
        current_job_id: eventType === "clock_in" ? jobId : null,
        current_location_lat: location.lat,
        current_location_lng: location.lng,
        last_location_at: new Date().toISOString(),
        clocked_in_at: eventType === "clock_in" ? new Date().toISOString() : null,
        status_since: new Date().toISOString(),
      }, { onConflict: "user_id" });

    console.log(`Override ${eventType} completed for job ${jobId}`);

    return new Response(
      JSON.stringify({
        success: true,
        clockEventId: clockEvent.id,
        alertId: alert?.id,
        timeEntryId,
        message: `${eventType === "clock_in" ? "Clock in" : "Clock out"} recorded with override`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in clock-in-with-override:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
