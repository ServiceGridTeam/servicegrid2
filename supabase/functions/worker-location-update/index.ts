import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create user client to get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for database operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get user's business_id
    const { data: profile } = await adminClient
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: "User not associated with a business" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: LocationUpdateRequest = await req.json();
    const { latitude, longitude, accuracy, heading, speed } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return new Response(JSON.stringify({ error: "Invalid coordinates" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    // Insert into worker_locations for historical tracking
    const { error: locationError } = await adminClient.from("worker_locations").insert({
      user_id: user.id,
      business_id: profile.business_id,
      latitude,
      longitude,
      accuracy_meters: accuracy,
      heading,
      speed_mps: speed,
      recorded_at: now,
    });

    if (locationError) {
      console.error("Failed to insert worker_location:", locationError);
    }

    // Upsert worker_statuses for current status
    const { error: statusError } = await adminClient.from("worker_statuses").upsert(
      {
        user_id: user.id,
        business_id: profile.business_id,
        current_location_lat: latitude,
        current_location_lng: longitude,
        last_location_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    if (statusError) {
      console.error("Failed to upsert worker_status:", statusError);
    }

    console.log(`Location updated for user ${user.id}: ${latitude}, ${longitude}`);

    return new Response(
      JSON.stringify({
        success: true,
        recorded_at: now,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Worker location update error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
