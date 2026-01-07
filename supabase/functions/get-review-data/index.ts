import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return errorResponse("Token required", 400);
    }

    console.log(`[get-review-data] Fetching data for token: ${token.substring(0, 8)}...`);

    // Fetch review request with related data
    const { data: request, error } = await supabase
      .from("review_requests")
      .select(`
        id,
        status,
        token_expires_at,
        customer:customers(first_name, last_name),
        job:jobs(title, completed_at, description),
        business:businesses(
          id,
          name,
          logo_url,
          slug
        )
      `)
      .eq("token", token)
      .single();

    if (error || !request) {
      console.error("[get-review-data] Request not found:", error);
      return errorResponse("Review request not found", 404);
    }

    // Check if token expired
    if (new Date(request.token_expires_at) < new Date()) {
      return errorResponse("This review link has expired", 410);
    }

    // Check if already completed
    if (request.status === "completed") {
      return successResponse({
        completed: true,
        message: "Thank you! Your feedback has already been submitted.",
      });
    }

    // Track click if not already clicked
    if (request.status === "sent" || request.status === "delivered") {
      await supabase
        .from("review_requests")
        .update({
          status: "clicked",
          clicked_at: new Date().toISOString(),
        })
        .eq("id", request.id);
    }

    const customer = request.customer as any;
    const job = request.job as any;
    const business = request.business as any;

    // Get review config for platform options
    const { data: config } = await supabase
      .from("review_configs")
      .select(`
        promoter_threshold,
        google_review_url,
        yelp_review_url,
        facebook_review_url
      `)
      .eq("business_id", business.id)
      .single();

    const platforms: { name: string; url: string; icon: string }[] = [];
    
    if (config?.google_review_url) {
      platforms.push({ name: "Google", url: config.google_review_url, icon: "google" });
    }
    if (config?.yelp_review_url) {
      platforms.push({ name: "Yelp", url: config.yelp_review_url, icon: "yelp" });
    }
    if (config?.facebook_review_url) {
      platforms.push({ name: "Facebook", url: config.facebook_review_url, icon: "facebook" });
    }

    return successResponse({
      completed: false,
      customerName: customer?.first_name || "Valued Customer",
      businessName: business?.name || "Our Business",
      businessLogo: business?.logo_url || null,
      jobTitle: job?.title || "Your recent service",
      jobCompletedAt: job?.completed_at || null,
      promoterThreshold: config?.promoter_threshold || 4,
      platforms,
    });
  } catch (error) {
    console.error("[get-review-data] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});

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
