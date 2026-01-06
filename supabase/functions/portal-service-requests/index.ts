import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
};

interface ActionRequest {
  action: string;
  businessId?: string;
  customerId?: string;
  serviceType?: string;
  description?: string;
  urgency?: string;
  preferredTimes?: string[];
  preferredDates?: string[];
  photoUrls?: string[];
  requestId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session
    const sessionToken = req.headers.get("x-portal-session");
    if (!sessionToken) {
      return errorResponse("Unauthorized", 401);
    }

    const { data: session, error: sessionError } = await supabase
      .from("customer_portal_sessions")
      .select("customer_account_id, active_business_id, active_customer_id")
      .eq("token", sessionToken)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return errorResponse("Invalid or expired session", 401);
    }

    const body: ActionRequest = await req.json();
    const { action } = body;

    console.log(`[portal-service-requests] Action: ${action}`);

    switch (action) {
      case "list":
        return await handleList(supabase, session);
      case "submit":
        return await handleSubmit(supabase, session, body);
      case "get":
        return await handleGet(supabase, session, body);
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error: unknown) {
    console.error("[portal-service-requests] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleList(supabase: any, session: any) {
  const { data: requests, error } = await supabase
    .from("customer_service_requests")
    .select("*")
    .eq("customer_id", session.active_customer_id)
    .eq("business_id", session.active_business_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[portal-service-requests] List error:", error);
    return errorResponse("Failed to fetch requests", 500);
  }

  return successResponse({ requests });
}

async function handleSubmit(supabase: any, session: any, body: ActionRequest) {
  const { serviceType, description, urgency, preferredTimes, preferredDates, photoUrls } = body;

  if (!description) {
    return errorResponse("Description is required", 400);
  }

  // Insert service request
  const { data: request, error } = await supabase
    .from("customer_service_requests")
    .insert({
      business_id: session.active_business_id,
      customer_id: session.active_customer_id,
      customer_account_id: session.customer_account_id,
      service_type: serviceType || null,
      description,
      urgency: urgency || "normal",
      preferred_times: preferredTimes ? JSON.stringify(preferredTimes) : null,
      preferred_dates: preferredDates ? JSON.stringify(preferredDates) : null,
      photo_urls: photoUrls || [],
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[portal-service-requests] Submit error:", error);
    return errorResponse("Failed to submit request", 500);
  }

  // Log activity
  await supabase.from("portal_activity_log").insert({
    customer_account_id: session.customer_account_id,
    business_id: session.active_business_id,
    activity_type: "service_request_submitted",
    entity_type: "service_request",
    entity_id: request.id,
    metadata: { requestNumber: request.request_number },
  });

  console.log(`[portal-service-requests] Request submitted: ${request.request_number}`);

  return successResponse({
    id: request.id,
    requestNumber: request.request_number,
  });
}

async function handleGet(supabase: any, session: any, body: ActionRequest) {
  const { requestId } = body;

  if (!requestId) {
    return errorResponse("Request ID is required", 400);
  }

  const { data: request, error } = await supabase
    .from("customer_service_requests")
    .select("*")
    .eq("id", requestId)
    .eq("customer_id", session.active_customer_id)
    .single();

  if (error || !request) {
    return errorResponse("Request not found", 404);
  }

  return successResponse({ request });
}

function successResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
