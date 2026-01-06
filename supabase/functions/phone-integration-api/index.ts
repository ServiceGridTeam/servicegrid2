import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyResult {
  valid: boolean;
  integration?: any;
  businessId?: string;
  permissions?: Record<string, boolean>;
  error?: { code: string; message: string; status: number };
}

// Hash API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Normalize phone number to digits only
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Remove leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

// Verify API key and check rate limits
async function verifyApiKey(
  supabase: any,
  authHeader: string | null
): Promise<VerifyResult> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: { code: "MISSING_KEY", message: "Authorization header required", status: 401 },
    };
  }

  const apiKey = authHeader.replace("Bearer ", "");
  const keyHash = await hashApiKey(apiKey);

  // Find integration by hash
  const { data: integration, error } = await supabase
    .from("phone_integrations")
    .select("*")
    .eq("api_key_hash", keyHash)
    .eq("status", "active")
    .single();

  if (error || !integration) {
    return {
      valid: false,
      error: { code: "INVALID_KEY", message: "API key is invalid or revoked", status: 401 },
    };
  }

  // Check rate limit (100 req/min)
  const now = new Date();
  const resetAt = integration.request_count_reset_at
    ? new Date(integration.request_count_reset_at)
    : null;
  const oneMinuteAgo = new Date(now.getTime() - 60000);

  let newCount = integration.request_count || 0;
  let newResetAt = integration.request_count_reset_at;

  if (!resetAt || resetAt < oneMinuteAgo) {
    // Reset counter
    newCount = 1;
    newResetAt = now.toISOString();
  } else {
    newCount += 1;
    if (newCount > 100) {
      return {
        valid: false,
        error: { code: "RATE_LIMITED", message: "Rate limit exceeded (100 req/min)", status: 429 },
      };
    }
  }

  // Update usage stats
  await supabase
    .from("phone_integrations")
    .update({
      last_used_at: now.toISOString(),
      request_count: newCount,
      request_count_reset_at: newResetAt,
    })
    .eq("id", integration.id);

  return {
    valid: true,
    integration,
    businessId: integration.business_id,
    permissions: integration.permissions || {},
  };
}

// Check if user has required permission
function hasPermission(permissions: Record<string, boolean>, required: string): boolean {
  return permissions[required] === true;
}

// Error response helper
function errorResponse(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Success response helper
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Calculate priority score from urgency
function calculatePriorityScore(urgency: string): number {
  switch (urgency) {
    case "emergency": return 100;
    case "urgent": return 75;
    case "soon": return 50;
    case "routine": return 25;
    default: return 25;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/phone-integration-api/, "");
  const method = req.method;

  console.log(`[phone-integration-api] ${method} ${path}`);

  // Verify API key for all requests
  const authHeader = req.headers.get("Authorization");
  const authResult = await verifyApiKey(supabase, authHeader);

  if (!authResult.valid) {
    console.log(`[phone-integration-api] Auth failed: ${authResult.error?.code}`);
    return errorResponse(
      authResult.error!.code,
      authResult.error!.message,
      authResult.error!.status
    );
  }

  const { businessId, permissions } = authResult;

  try {
    // =====================
    // POST /lookup-customer
    // =====================
    if (method === "POST" && path === "/lookup-customer") {
      if (!hasPermission(permissions!, "lookup_customer")) {
        return errorResponse("PERMISSION_DENIED", "Missing lookup_customer permission", 403);
      }

      const body = await req.json();
      const { phone } = body;

      if (!phone) {
        return errorResponse("VALIDATION_ERROR", "Phone number required", 400);
      }

      const normalizedPhone = normalizePhone(phone);
      console.log(`[lookup-customer] Searching for phone: ${normalizedPhone}`);

      // Search customers with flexible matching
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select("id, name, email, phone, address, notes")
        .eq("business_id", businessId);

      if (custError) {
        console.error("[lookup-customer] Query error:", custError);
        return errorResponse("INTERNAL_ERROR", "Failed to search customers", 500);
      }

      // Find matching customer by normalized phone
      const customer = customers?.find((c: any) => {
        if (!c.phone) return false;
        return normalizePhone(c.phone) === normalizedPhone;
      });

      if (!customer) {
        return jsonResponse({ found: false });
      }

      // Get active jobs for this customer
      const { data: activeJobs } = await supabase
        .from("jobs")
        .select("id, job_number, title, status, scheduled_start, scheduled_end, address")
        .eq("customer_id", customer.id)
        .in("status", ["scheduled", "in_progress", "on_hold"])
        .order("scheduled_start", { ascending: true });

      return jsonResponse({
        found: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        },
        active_jobs: activeJobs || [],
      });
    }

    // =====================
    // GET /jobs
    // =====================
    if (method === "GET" && path === "/jobs") {
      if (!hasPermission(permissions!, "read_jobs")) {
        return errorResponse("PERMISSION_DENIED", "Missing read_jobs permission", 403);
      }

      const customerId = url.searchParams.get("customer_id");
      const jobNumber = url.searchParams.get("job_number");

      let query = supabase
        .from("jobs")
        .select("id, job_number, title, description, status, scheduled_start, scheduled_end, address, assigned_to")
        .eq("business_id", businessId);

      if (customerId) {
        query = query.eq("customer_id", customerId);
      }
      if (jobNumber) {
        query = query.eq("job_number", jobNumber);
      }

      const { data: jobs, error } = await query.order("scheduled_start", { ascending: false }).limit(50);

      if (error) {
        console.error("[jobs] Query error:", error);
        return errorResponse("INTERNAL_ERROR", "Failed to fetch jobs", 500);
      }

      return jsonResponse({ jobs: jobs || [] });
    }

    // =====================
    // GET /jobs/:id/eta
    // =====================
    const etaMatch = path.match(/^\/jobs\/([^/]+)\/eta$/);
    if (method === "GET" && etaMatch) {
      if (!hasPermission(permissions!, "read_technician_eta")) {
        return errorResponse("PERMISSION_DENIED", "Missing read_technician_eta permission", 403);
      }

      const jobId = etaMatch[1];

      const { data: job, error } = await supabase
        .from("jobs")
        .select("id, status, scheduled_start, assigned_to, eta_minutes")
        .eq("id", jobId)
        .eq("business_id", businessId)
        .single();

      if (error || !job) {
        return errorResponse("NOT_FOUND", "Job not found", 404);
      }

      // Get technician name if assigned
      let technicianName = null;
      if (job.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", job.assigned_to)
          .single();
        if (profile) {
          technicianName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Technician";
        }
      }

      return jsonResponse({
        has_eta: !!job.eta_minutes,
        eta_minutes: job.eta_minutes || null,
        technician_name: technicianName,
        status: job.status,
        scheduled_start: job.scheduled_start,
      });
    }

    // =====================
    // POST /check-service-area
    // =====================
    if (method === "POST" && path === "/check-service-area") {
      const body = await req.json();
      const { address } = body;

      if (!address) {
        return errorResponse("VALIDATION_ERROR", "Address required", 400);
      }

      // Get business settings
      const { data: business } = await supabase
        .from("businesses")
        .select("settings")
        .eq("id", businessId)
        .single();

      const serviceArea = business?.settings?.service_area;

      if (!serviceArea || serviceArea.type === "none") {
        return jsonResponse({
          in_service_area: true,
          description: "No service area restrictions configured",
        });
      }

      // Geocode the address
      const geocodeResponse = await supabase.functions.invoke("geocode-address", {
        body: { address },
      });

      if (geocodeResponse.error || !geocodeResponse.data?.latitude) {
        return jsonResponse({
          in_service_area: false,
          description: "Could not verify address location",
        });
      }

      const { latitude, longitude } = geocodeResponse.data;

      if (serviceArea.type === "radius" && serviceArea.center) {
        // Calculate distance using Haversine formula
        const R = 3959; // Earth's radius in miles
        const lat1 = serviceArea.center.lat * (Math.PI / 180);
        const lat2 = latitude * (Math.PI / 180);
        const dLat = (latitude - serviceArea.center.lat) * (Math.PI / 180);
        const dLng = (longitude - serviceArea.center.lng) * (Math.PI / 180);

        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        const radiusMiles = serviceArea.radius_miles || 25;
        const inArea = distance <= radiusMiles;

        return jsonResponse({
          in_service_area: inArea,
          distance_miles: Math.round(distance * 10) / 10,
          description: inArea
            ? `Address is ${Math.round(distance)} miles from service center`
            : `Address is ${Math.round(distance)} miles away, outside our ${radiusMiles} mile service area`,
        });
      }

      return jsonResponse({
        in_service_area: true,
        description: "Service area check completed",
      });
    }

    // =====================
    // POST /requests
    // =====================
    if (method === "POST" && path === "/requests") {
      if (!hasPermission(permissions!, "create_requests")) {
        return errorResponse("PERMISSION_DENIED", "Missing create_requests permission", 403);
      }

      const body = await req.json();
      const {
        form_data,
        customer_id,
        source_metadata,
        service_type,
        description,
        address,
        urgency = "routine",
        preferred_date,
        preferred_time,
        customer_name,
        customer_phone,
        customer_email,
      } = body;

      // Validate required fields
      if (!description && !form_data?.description) {
        return errorResponse("VALIDATION_ERROR", "Description is required", 400);
      }

      const priorityScore = calculatePriorityScore(urgency);

      const { data: request, error } = await supabase
        .from("job_requests")
        .insert({
          business_id: businessId,
          customer_id: customer_id || null,
          source: "phone",
          source_metadata: source_metadata || {},
          form_data: form_data || {},
          service_type: service_type || null,
          description: description || form_data?.description,
          address: address || null,
          urgency,
          preferred_date: preferred_date || null,
          preferred_time: preferred_time || null,
          customer_name: customer_name || null,
          customer_phone: customer_phone || null,
          customer_email: customer_email || null,
          status: "pending",
          priority_score: priorityScore,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[requests] Insert error:", error);
        return errorResponse("INTERNAL_ERROR", "Failed to create request", 500);
      }

      console.log(`[requests] Created job request: ${request.id}`);

      return jsonResponse({
        success: true,
        request_id: request.id,
        confirmation_message: `Your service request has been submitted. A team member will review it shortly.`,
      });
    }

    // =====================
    // POST /modifications
    // =====================
    if (method === "POST" && path === "/modifications") {
      if (!hasPermission(permissions!, "modify_jobs")) {
        return errorResponse("PERMISSION_DENIED", "Missing modify_jobs permission", 403);
      }

      const body = await req.json();
      const {
        job_id,
        modification_type,
        reason,
        requested_date,
        time_preference,
        source_metadata,
      } = body;

      if (!job_id) {
        return errorResponse("VALIDATION_ERROR", "job_id is required", 400);
      }

      if (!modification_type || !["reschedule", "cancel"].includes(modification_type)) {
        return errorResponse("VALIDATION_ERROR", "modification_type must be 'reschedule' or 'cancel'", 400);
      }

      // Verify job exists and belongs to business
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("id, business_id")
        .eq("id", job_id)
        .eq("business_id", businessId)
        .single();

      if (jobError || !job) {
        return errorResponse("NOT_FOUND", "Job not found", 404);
      }

      const { data: modification, error } = await supabase
        .from("job_modification_requests")
        .insert({
          job_id,
          business_id: businessId,
          modification_type,
          reason: reason || null,
          requested_date: requested_date || null,
          time_preference: time_preference || null,
          source: "phone",
          source_metadata: source_metadata || {},
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        console.error("[modifications] Insert error:", error);
        return errorResponse("INTERNAL_ERROR", "Failed to create modification request", 500);
      }

      console.log(`[modifications] Created modification request: ${modification.id}`);

      const message = modification_type === "cancel"
        ? "Your cancellation request has been submitted for review."
        : "Your reschedule request has been submitted. A team member will confirm the new time.";

      return jsonResponse({
        success: true,
        modification_id: modification.id,
        message,
      });
    }

    // =====================
    // GET /config
    // =====================
    if (method === "GET" && path === "/config") {
      const { data: business, error } = await supabase
        .from("businesses")
        .select("id, name, settings")
        .eq("id", businessId)
        .single();

      if (error || !business) {
        return errorResponse("INTERNAL_ERROR", "Failed to fetch business config", 500);
      }

      const settings = business.settings || {};

      return jsonResponse({
        business_id: business.id,
        business_name: business.name,
        service_types: settings.service_types || [],
        service_area: settings.service_area || { type: "none" },
        job_request_fields: settings.job_request_fields || [
          { name: "description", type: "text", required: true },
          { name: "urgency", type: "select", options: ["routine", "soon", "urgent", "emergency"] },
          { name: "preferred_date", type: "date" },
          { name: "preferred_time", type: "text" },
        ],
        business_hours: settings.business_hours || null,
        permissions: permissions,
      });
    }

    // =====================
    // 404 - Unknown route
    // =====================
    return errorResponse("NOT_FOUND", `Unknown endpoint: ${method} ${path}`, 404);

  } catch (err) {
    console.error("[phone-integration-api] Unhandled error:", err);
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
});
