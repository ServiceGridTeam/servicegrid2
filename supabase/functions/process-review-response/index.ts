import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyBusinessTeam } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewSubmission {
  token: string;
  rating: number;
  feedbackText?: string;
  technicianRating?: number;
  timelinessRating?: number;
  qualityRating?: number;
  valueRating?: number;
  platform?: "google" | "yelp" | "facebook" | "internal";
  displayName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: ReviewSubmission = await req.json();
    const { token, rating, feedbackText, technicianRating, timelinessRating, qualityRating, valueRating, platform, displayName } = body;

    if (!token || !rating || rating < 1 || rating > 5) {
      return errorResponse("Valid token and rating (1-5) required", 400);
    }

    console.log(`[process-review-response] Processing review for token: ${token.substring(0, 8)}...`);

    // Fetch review request
    const { data: request, error: requestError } = await supabase
      .from("review_requests")
      .select(`
        id,
        business_id,
        customer_id,
        job_id,
        assigned_technician_id,
        status,
        token_expires_at
      `)
      .eq("token", token)
      .single();

    if (requestError || !request) {
      console.error("[process-review-response] Request not found:", requestError);
      return errorResponse("Review request not found", 404);
    }

    // Check if token expired
    if (new Date(request.token_expires_at) < new Date()) {
      return errorResponse("This review link has expired", 410);
    }

    // Check if already completed
    if (request.status === "completed") {
      return errorResponse("Feedback already submitted", 400);
    }

    // Get review config for thresholds
    const { data: config } = await supabase
      .from("review_configs")
      .select("promoter_threshold, google_review_url, yelp_review_url, facebook_review_url")
      .eq("business_id", request.business_id)
      .single();

    const promoterThreshold = config?.promoter_threshold || 4;
    const isPromoter = rating >= promoterThreshold;

    // Determine sentiment
    let sentiment: "positive" | "neutral" | "negative" = "neutral";
    if (rating >= 4) sentiment = "positive";
    else if (rating <= 2) sentiment = "negative";

    // Create review
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        business_id: request.business_id,
        customer_id: request.customer_id,
        job_id: request.job_id,
        review_request_id: request.id,
        assigned_technician_id: request.assigned_technician_id,
        rating,
        feedback_text: feedbackText || null,
        feedback_sentiment: sentiment,
        technician_rating: technicianRating || null,
        timeliness_rating: timelinessRating || null,
        quality_rating: qualityRating || null,
        value_rating: valueRating || null,
        is_public: isPromoter && platform !== "internal",
        platform: platform || "internal",
        display_name: displayName || null,
        source: "request",
      })
      .select()
      .single();

    if (reviewError) {
      console.error("[process-review-response] Failed to create review:", reviewError);
      return errorResponse("Failed to save review", 500);
    }

    // Update review request
    await supabase
      .from("review_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        review_id: review.id,
      })
      .eq("id", request.id);

    // Update job
    await supabase
      .from("jobs")
      .update({
        review_id: review.id,
        review_completed_at: new Date().toISOString(),
      })
      .eq("id", request.job_id);

    // Update customer stats
    const { data: customerStats } = await supabase
      .from("reviews")
      .select("rating")
      .eq("customer_id", request.customer_id);

    const totalReviews = customerStats?.length || 1;
    const avgRating = customerStats
      ? customerStats.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : rating;

    await supabase
      .from("customers")
      .update({
        total_reviews_given: totalReviews,
        average_rating_given: Math.round(avgRating * 10) / 10,
      })
      .eq("id", request.customer_id);

    // Update review config stats
    if (config) {
      const { data: allReviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("business_id", request.business_id);

      const totalBusinessReviews = allReviews?.length || 1;
      const businessAvgRating = allReviews
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalBusinessReviews
        : rating;

      const { data: requestStats } = await supabase
        .from("review_requests")
        .select("id")
        .eq("business_id", request.business_id)
        .eq("status", "completed");

      const { data: allRequests } = await supabase
        .from("review_requests")
        .select("id")
        .eq("business_id", request.business_id)
        .in("status", ["sent", "delivered", "opened", "clicked", "completed"]);

      const responseRate = allRequests?.length
        ? ((requestStats?.length || 0) / allRequests.length) * 100
        : 0;

      await supabase
        .from("review_configs")
        .update({
          total_reviews_received: totalBusinessReviews,
          average_rating: Math.round(businessAvgRating * 10) / 10,
          response_rate: Math.round(responseRate * 100) / 100,
        })
        .eq("business_id", request.business_id);
    }

    // Update technician stats if assigned
    if (request.assigned_technician_id) {
      await updateTechnicianStats(supabase, request.business_id, request.assigned_technician_id);
    }

    // Notify business team
    const ratingStars = "★".repeat(rating) + "☆".repeat(5 - rating);
    await notifyBusinessTeam(supabase, request.business_id, {
      type: "portal",
      title: `New ${rating}-Star Review`,
      message: `A customer left a ${ratingStars} review${feedbackText ? `: "${feedbackText.substring(0, 50)}..."` : ""}`,
      data: { reviewId: review.id, rating },
    });

    console.log(`[process-review-response] Review created: ${review.id}`);

    // Determine redirect URL for promoters
    let redirectUrl: string | null = null;
    if (isPromoter && platform && platform !== "internal") {
      if (platform === "google" && config?.google_review_url) {
        redirectUrl = config.google_review_url;
      } else if (platform === "yelp" && config?.yelp_review_url) {
        redirectUrl = config.yelp_review_url;
      } else if (platform === "facebook" && config?.facebook_review_url) {
        redirectUrl = config.facebook_review_url;
      }
    }

    return successResponse({
      success: true,
      reviewId: review.id,
      isPromoter,
      redirectUrl,
    });
  } catch (error) {
    console.error("[process-review-response] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});

async function updateTechnicianStats(supabase: any, businessId: string, profileId: string) {
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("business_id", businessId)
    .eq("assigned_technician_id", profileId);

  if (!reviews || reviews.length === 0) return;

  const totalReviews = reviews.length;
  const avgRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews;
  const fiveStarCount = reviews.filter((r: any) => r.rating === 5).length;
  const fourStarCount = reviews.filter((r: any) => r.rating === 4).length;
  const threeStarCount = reviews.filter((r: any) => r.rating === 3).length;
  const twoStarCount = reviews.filter((r: any) => r.rating === 2).length;
  const oneStarCount = reviews.filter((r: any) => r.rating === 1).length;

  await supabase
    .from("technician_review_stats")
    .upsert({
      business_id: businessId,
      profile_id: profileId,
      total_reviews: totalReviews,
      average_rating: Math.round(avgRating * 10) / 10,
      five_star_count: fiveStarCount,
      four_star_count: fourStarCount,
      three_star_count: threeStarCount,
      two_star_count: twoStarCount,
      one_star_count: oneStarCount,
      last_review_at: new Date().toISOString(),
    }, {
      onConflict: "business_id,profile_id",
    });

  // Recalculate ranks for business
  const { data: allStats } = await supabase
    .from("technician_review_stats")
    .select("id, average_rating, total_reviews")
    .eq("business_id", businessId)
    .order("average_rating", { ascending: false })
    .order("total_reviews", { ascending: false });

  if (allStats) {
    for (let i = 0; i < allStats.length; i++) {
      await supabase
        .from("technician_review_stats")
        .update({ rank_in_business: i + 1 })
        .eq("id", allStats[i].id);
    }
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
