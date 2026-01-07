import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateResponseRequest {
  reviewId: string;
  tone?: "professional" | "friendly" | "empathetic";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!lovableApiKey) {
      return errorResponse("AI service not configured", 500);
    }

    const body: GenerateResponseRequest = await req.json();
    const { reviewId, tone = "professional" } = body;

    console.log(`[generate-review-response] Generating response for review: ${reviewId}`);

    // Fetch review with context
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select(`
        id,
        rating,
        feedback_text,
        feedback_sentiment,
        technician_rating,
        timeliness_rating,
        quality_rating,
        value_rating,
        customer:customers(first_name),
        job:jobs(title, description),
        business:businesses(name)
      `)
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      console.error("[generate-review-response] Review not found:", reviewError);
      return errorResponse("Review not found", 404);
    }

    const customer = review.customer as any;
    const job = review.job as any;
    const business = review.business as any;

    // Build context for AI
    const context = {
      businessName: business?.name || "Our Business",
      customerName: customer?.first_name || "Valued Customer",
      jobTitle: job?.title || "the service",
      rating: review.rating,
      feedbackText: review.feedback_text || "",
      sentiment: review.feedback_sentiment || "neutral",
      subRatings: {
        technician: review.technician_rating,
        timeliness: review.timeliness_rating,
        quality: review.quality_rating,
        value: review.value_rating,
      },
    };

    // Generate response using Lovable AI
    const prompt = buildPrompt(context, tone);

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a customer service representative for ${context.businessName}. Your task is to write thoughtful, personalized responses to customer reviews. Be genuine, acknowledge specific feedback, and maintain a ${tone} tone. Keep responses concise (2-4 sentences for positive reviews, 3-5 sentences for negative reviews).`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      console.error("[generate-review-response] AI request failed:", errorData);
      return errorResponse("Failed to generate response", 500);
    }

    const aiResult = await aiResponse.json();
    const suggestedResponse = aiResult.choices?.[0]?.message?.content?.trim() || "";

    if (!suggestedResponse) {
      return errorResponse("Failed to generate response", 500);
    }

    // Save suggested response
    await supabase
      .from("reviews")
      .update({ response_suggested: suggestedResponse })
      .eq("id", reviewId);

    console.log(`[generate-review-response] Generated response for review: ${reviewId}`);

    return successResponse({
      suggestedResponse,
    });
  } catch (error) {
    console.error("[generate-review-response] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500);
  }
});

function buildPrompt(context: any, tone: string): string {
  const { customerName, jobTitle, rating, feedbackText, sentiment, subRatings } = context;

  let prompt = `Write a ${tone} response to this ${rating}-star review`;
  
  if (customerName !== "Valued Customer") {
    prompt += ` from ${customerName}`;
  }

  prompt += ` about ${jobTitle}.`;

  if (feedbackText) {
    prompt += `\n\nCustomer's feedback: "${feedbackText}"`;
  }

  // Add context about sub-ratings if any are low
  const lowRatings: string[] = [];
  if (subRatings.technician && subRatings.technician <= 2) lowRatings.push("technician service");
  if (subRatings.timeliness && subRatings.timeliness <= 2) lowRatings.push("timeliness");
  if (subRatings.quality && subRatings.quality <= 2) lowRatings.push("quality");
  if (subRatings.value && subRatings.value <= 2) lowRatings.push("value");

  if (lowRatings.length > 0) {
    prompt += `\n\nNote: The customer rated ${lowRatings.join(" and ")} lower than other aspects.`;
  }

  if (sentiment === "negative" || rating <= 2) {
    prompt += "\n\nThis is a negative review. Express genuine concern, apologize for their experience, and offer to make things right. Don't be defensive.";
  } else if (rating >= 4) {
    prompt += "\n\nThis is a positive review. Thank them warmly and express genuine appreciation.";
  }

  return prompt;
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
