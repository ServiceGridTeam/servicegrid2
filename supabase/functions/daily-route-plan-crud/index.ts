import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${req.method} request for user ${user.id}`);

    switch (req.method) {
      case "GET":
        return await handleGet(req, supabase, user.id);
      case "POST":
        return await handlePost(req, supabase, user.id);
      case "PUT":
        return await handlePut(req, supabase);
      case "DELETE":
        return await handleDelete(req, supabase);
      default:
        return new Response(
          JSON.stringify({ error: "Method not allowed" }),
          { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGet(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const userIdParam = url.searchParams.get("userId");
  const date = url.searchParams.get("date");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const includeJobs = url.searchParams.get("includeJobs") === "true";

  console.log("GET params:", { id, userId: userIdParam, date, dateFrom, dateTo, includeJobs });

  // Fetch by ID
  if (id) {
    const { data, error } = await supabase
      .from("daily_route_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching route plan by ID:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch route plan", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Route plan not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally fetch jobs
    let jobs = null;
    if (includeJobs && data.job_ids?.length > 0) {
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .in("id", data.job_ids)
        .order("route_sequence", { ascending: true, nullsFirst: false });
      jobs = jobsData;
    }

    return new Response(
      JSON.stringify({ data: { ...data, jobs } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch by user + date
  if (userIdParam && date) {
    const { data, error } = await supabase
      .from("daily_route_plans")
      .select("*")
      .eq("user_id", userIdParam)
      .eq("route_date", date)
      .maybeSingle();

    if (error) {
      console.error("Error fetching route plan by user+date:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch route plan", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let jobs = null;
    if (data && includeJobs && data.job_ids?.length > 0) {
      const { data: jobsData } = await supabase
        .from("jobs")
        .select("*")
        .in("id", data.job_ids)
        .order("route_sequence", { ascending: true, nullsFirst: false });
      jobs = jobsData;
    }

    return new Response(
      JSON.stringify({ data: data ? { ...data, jobs } : null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch by date range
  if (userIdParam && (dateFrom || dateTo)) {
    let query = supabase
      .from("daily_route_plans")
      .select("*")
      .eq("user_id", userIdParam)
      .order("route_date", { ascending: true });

    if (dateFrom) query = query.gte("route_date", dateFrom);
    if (dateTo) query = query.lte("route_date", dateTo);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching route plans by date range:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch route plans", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: "Missing required parameters: id, or userId+date, or userId+dateFrom/dateTo" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handlePost(req: Request, supabase: any, userId: string) {
  const body = await req.json();
  const { user_id, route_date, job_ids, start_location, end_location } = body;

  console.log("POST body:", body);

  if (!user_id || !route_date) {
    return new Response(
      JSON.stringify({ error: "user_id and route_date are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get business_id from the requesting user's profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("business_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile?.business_id) {
    console.error("Error fetching profile:", profileError);
    return new Response(
      JSON.stringify({ error: "Could not determine business" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if route plan already exists for this user+date
  const { data: existing } = await supabase
    .from("daily_route_plans")
    .select("id")
    .eq("user_id", user_id)
    .eq("route_date", route_date)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "Route plan already exists for this user and date", existing_id: existing.id }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create the route plan
  const { data: routePlan, error: createError } = await supabase
    .from("daily_route_plans")
    .insert({
      business_id: profile.business_id,
      user_id,
      route_date,
      job_ids: job_ids || [],
      start_location,
      end_location,
      status: "draft",
    })
    .select()
    .single();

  if (createError) {
    console.error("Error creating route plan:", createError);
    return new Response(
      JSON.stringify({ error: "Failed to create route plan", details: createError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Created route plan:", routePlan.id);

  // Link jobs to this route plan
  if (job_ids?.length > 0) {
    for (let i = 0; i < job_ids.length; i++) {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ route_plan_id: routePlan.id, route_sequence: i })
        .eq("id", job_ids[i]);

      if (updateError) {
        console.error(`Error linking job ${job_ids[i]}:`, updateError);
      }
    }
    console.log(`Linked ${job_ids.length} jobs to route plan`);
  }

  return new Response(
    JSON.stringify({ data: routePlan }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handlePut(req: Request, supabase: any) {
  const body = await req.json();
  const { id, job_ids, optimized_sequence, status, start_location, end_location, 
          total_distance_meters, total_duration_seconds, overview_polyline } = body;

  console.log("PUT body:", body);

  if (!id) {
    return new Response(
      JSON.stringify({ error: "id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get existing route plan
  const { data: existing, error: fetchError } = await supabase
    .from("daily_route_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    console.error("Error fetching route plan:", fetchError);
    return new Response(
      JSON.stringify({ error: "Route plan not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Build update object
  const updates: Record<string, any> = {};
  if (job_ids !== undefined) updates.job_ids = job_ids;
  if (optimized_sequence !== undefined) updates.optimized_sequence = optimized_sequence;
  if (status !== undefined) updates.status = status;
  if (start_location !== undefined) updates.start_location = start_location;
  if (end_location !== undefined) updates.end_location = end_location;
  if (total_distance_meters !== undefined) updates.total_distance_meters = total_distance_meters;
  if (total_duration_seconds !== undefined) updates.total_duration_seconds = total_duration_seconds;
  if (overview_polyline !== undefined) updates.overview_polyline = overview_polyline;

  // Update route plan
  const { data: updated, error: updateError } = await supabase
    .from("daily_route_plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating route plan:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to update route plan", details: updateError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Updated route plan:", id);

  // Handle job linking changes
  if (job_ids !== undefined) {
    const oldJobIds = existing.job_ids || [];
    const newJobIds = job_ids || [];

    // Find jobs to unlink (were in old, not in new)
    const jobsToUnlink = oldJobIds.filter((jid: string) => !newJobIds.includes(jid));
    
    // Find jobs to link (are in new, not in old)
    const jobsToLink = newJobIds.filter((jid: string) => !oldJobIds.includes(jid));

    // Unlink removed jobs
    if (jobsToUnlink.length > 0) {
      const { error } = await supabase
        .from("jobs")
        .update({ route_plan_id: null, route_sequence: null })
        .in("id", jobsToUnlink);

      if (error) console.error("Error unlinking jobs:", error);
      else console.log(`Unlinked ${jobsToUnlink.length} jobs`);
    }

    // Update sequence for all jobs in the plan
    const sequence = optimized_sequence || newJobIds.map((_: any, i: number) => i);
    for (let i = 0; i < newJobIds.length; i++) {
      const seqIndex = sequence[i];
      const { error } = await supabase
        .from("jobs")
        .update({ route_plan_id: id, route_sequence: seqIndex })
        .eq("id", newJobIds[i]);

      if (error) console.error(`Error updating job ${newJobIds[i]} sequence:`, error);
    }
    console.log(`Updated sequence for ${newJobIds.length} jobs`);
  }

  return new Response(
    JSON.stringify({ data: updated }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(req: Request, supabase: any) {
  const body = await req.json();
  const { id } = body;

  console.log("DELETE body:", body);

  if (!id) {
    return new Response(
      JSON.stringify({ error: "id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get existing route plan to find linked jobs
  const { data: existing, error: fetchError } = await supabase
    .from("daily_route_plans")
    .select("job_ids")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    console.error("Error fetching route plan:", fetchError);
    return new Response(
      JSON.stringify({ error: "Route plan not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const jobCount = existing.job_ids?.length || 0;

  // Unlink all jobs from this route plan
  if (jobCount > 0) {
    const { error: unlinkError } = await supabase
      .from("jobs")
      .update({ route_plan_id: null, route_sequence: null })
      .in("id", existing.job_ids);

    if (unlinkError) {
      console.error("Error unlinking jobs:", unlinkError);
    } else {
      console.log(`Unlinked ${jobCount} jobs from route plan`);
    }
  }

  // Delete the route plan
  const { error: deleteError } = await supabase
    .from("daily_route_plans")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Error deleting route plan:", deleteError);
    return new Response(
      JSON.stringify({ error: "Failed to delete route plan", details: deleteError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log("Deleted route plan:", id);

  return new Response(
    JSON.stringify({ success: true, message: `Route plan deleted and ${jobCount} jobs unlinked` }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
