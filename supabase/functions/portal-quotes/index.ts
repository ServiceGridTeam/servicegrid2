import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-session",
};

interface ActionRequest {
  action: string;
  quoteId?: string;
  reason?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get session token from header
    const sessionToken = req.headers.get("x-portal-session");
    if (!sessionToken) {
      return errorResponse("Unauthorized", 401);
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("customer_portal_sessions")
      .select("customer_account_id, active_customer_id, active_business_id")
      .eq("token", sessionToken)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return errorResponse("Invalid or expired session", 401);
    }

    const body: ActionRequest = await req.json();
    const { action, quoteId } = body;

    console.log(`[portal-quotes] Action: ${action}, QuoteId: ${quoteId}`);

    if (!quoteId) {
      return errorResponse("Quote ID is required", 400);
    }

    // Verify quote belongs to this customer
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status, customer_id, business_id")
      .eq("id", quoteId)
      .eq("customer_id", session.active_customer_id)
      .single();

    if (quoteError || !quote) {
      return errorResponse("Quote not found", 404);
    }

    switch (action) {
      case "approve":
        return await handleApprove(supabase, quote, session);
      case "decline":
        return await handleDecline(supabase, quote, session, body.reason);
      case "request-changes":
        return await handleRequestChanges(supabase, quote, session, body.notes);
      default:
        return errorResponse("Unknown action", 400);
    }
  } catch (error: unknown) {
    console.error("[portal-quotes] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(errorMessage, 500);
  }
});

async function handleApprove(supabase: any, quote: any, session: any) {
  // Only allow approving quotes in 'Sent' status
  if (quote.status !== "Sent") {
    return errorResponse(`Cannot approve quote with status: ${quote.status}`, 400);
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "Approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  if (updateError) {
    console.error("[portal-quotes] Failed to approve:", updateError);
    return errorResponse("Failed to approve quote", 500);
  }

  // Log activity (if table exists)
  await logActivity(supabase, {
    businessId: quote.business_id,
    customerId: session.active_customer_id,
    customerAccountId: session.customer_account_id,
    activityType: "quote_approved",
    relatedId: quote.id,
  });

  console.log(`[portal-quotes] Quote ${quote.id} approved`);
  return successResponse({ success: true, newStatus: "Approved" });
}

async function handleDecline(supabase: any, quote: any, session: any, reason?: string) {
  if (quote.status !== "Sent") {
    return errorResponse(`Cannot decline quote with status: ${quote.status}`, 400);
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "Declined",
      decline_reason: reason || null,
    })
    .eq("id", quote.id);

  if (updateError) {
    console.error("[portal-quotes] Failed to decline:", updateError);
    return errorResponse("Failed to decline quote", 500);
  }

  await logActivity(supabase, {
    businessId: quote.business_id,
    customerId: session.active_customer_id,
    customerAccountId: session.customer_account_id,
    activityType: "quote_declined",
    relatedId: quote.id,
  });

  console.log(`[portal-quotes] Quote ${quote.id} declined`);
  return successResponse({ success: true, newStatus: "Declined" });
}

async function handleRequestChanges(supabase: any, quote: any, session: any, notes?: string) {
  if (quote.status !== "Sent") {
    return errorResponse(`Cannot request changes for quote with status: ${quote.status}`, 400);
  }

  if (!notes || notes.trim().length === 0) {
    return errorResponse("Change notes are required", 400);
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      status: "Edits Requested",
      change_request_notes: notes,
    })
    .eq("id", quote.id);

  if (updateError) {
    console.error("[portal-quotes] Failed to request changes:", updateError);
    return errorResponse("Failed to request changes", 500);
  }

  await logActivity(supabase, {
    businessId: quote.business_id,
    customerId: session.active_customer_id,
    customerAccountId: session.customer_account_id,
    activityType: "quote_changes_requested",
    relatedId: quote.id,
  });

  console.log(`[portal-quotes] Changes requested for quote ${quote.id}`);
  return successResponse({ success: true, newStatus: "Edits Requested" });
}

async function logActivity(supabase: any, data: {
  businessId: string;
  customerId: string;
  customerAccountId: string;
  activityType: string;
  relatedId: string;
}) {
  try {
    // Check if portal_activity_log table exists
    const { error } = await supabase
      .from("portal_activity_log")
      .insert({
        business_id: data.businessId,
        customer_id: data.customerId,
        customer_account_id: data.customerAccountId,
        activity_type: data.activityType,
        related_id: data.relatedId,
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      console.log("[portal-quotes] Activity log insert skipped:", error.message);
    }
  } catch (err) {
    // Table may not exist - ignore
    console.log("[portal-quotes] Activity logging skipped");
  }
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
