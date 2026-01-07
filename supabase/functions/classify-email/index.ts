import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ClassifyRequest {
  email_id: string;
}

interface ClassificationResult {
  classification: string;
  confidence: number;
  tier: "ai" | "rules" | "keywords";
  extracted_data?: {
    service_type?: string;
    issue_description?: string;
    urgency?: string;
    address?: string;
    phone?: string;
    customer_name?: string;
  };
}

// Keyword patterns for Tier 3 fallback
const SERVICE_KEYWORDS = [
  "repair", "fix", "broken", "leak", "leaking", "clogged", "install", "installation",
  "replace", "replacement", "maintenance", "service", "inspect", "inspection",
  "emergency", "urgent", "asap", "help", "issue", "problem", "not working",
];

const QUOTE_KEYWORDS = [
  "quote", "estimate", "cost", "price", "pricing", "how much", "rate", "rates",
];

const SPAM_KEYWORDS = [
  "unsubscribe", "newsletter", "promotion", "sale", "discount", "offer",
  "marketing", "advertisement", "bulk", "mass email",
];

function classifyByKeywords(subject: string, body: string): ClassificationResult {
  const text = `${subject} ${body}`.toLowerCase();
  
  // Check for spam first
  const spamCount = SPAM_KEYWORDS.filter(kw => text.includes(kw)).length;
  if (spamCount >= 2) {
    return { classification: "spam", confidence: 0.5, tier: "keywords" };
  }
  
  // Check for service request keywords
  const serviceCount = SERVICE_KEYWORDS.filter(kw => text.includes(kw)).length;
  if (serviceCount >= 2) {
    return { 
      classification: "service_request", 
      confidence: Math.min(0.3 + serviceCount * 0.1, 0.6), 
      tier: "keywords" 
    };
  }
  
  // Check for quote request
  const quoteCount = QUOTE_KEYWORDS.filter(kw => text.includes(kw)).length;
  if (quoteCount >= 1) {
    return { classification: "inquiry", confidence: 0.4, tier: "keywords" };
  }
  
  // Default to inquiry with low confidence
  return { classification: "inquiry", confidence: 0.3, tier: "keywords" };
}

async function classifyWithAI(
  supabase: any,
  emailId: string,
  subject: string,
  body: string,
  fromAddress: string
): Promise<ClassificationResult | null> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  
  if (!lovableApiKey) {
    console.log("LOVABLE_API_KEY not configured, skipping AI classification");
    return null;
  }

  try {
    // Update stage to "analyzing"
    await supabase
      .from("inbound_emails")
      .update({ classification_stage: "analyzing" })
      .eq("id", emailId);

    const prompt = `You are an email classifier for a field service business. Analyze this email and classify it.

Email Subject: ${subject}
Email From: ${fromAddress}
Email Body:
${body.slice(0, 2000)}

Classify this email into ONE of these categories:
- service_request: Customer needs a service performed (repair, installation, maintenance)
- inquiry: Customer asking questions, requesting quotes, or general information
- spam: Marketing, promotional, or irrelevant emails
- out_of_scope: Not related to field services at all

Also extract any relevant information if this is a service request:
- service_type: What type of service is needed
- issue_description: Brief description of the issue
- urgency: low, normal, high, or emergency
- address: Any address mentioned
- phone: Any phone number mentioned
- customer_name: Customer's name if mentioned

Respond in JSON format:
{
  "classification": "service_request|inquiry|spam|out_of_scope",
  "confidence": 0.0-1.0,
  "extracted_data": {
    "service_type": "string or null",
    "issue_description": "string or null",
    "urgency": "low|normal|high|emergency or null",
    "address": "string or null",
    "phone": "string or null",
    "customer_name": "string or null"
  }
}`;

    // Update stage to "reading"
    await supabase
      .from("inbound_emails")
      .update({ classification_stage: "reading" })
      .eq("id", emailId);

    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI classification failed:", errorText);
      return null;
    }

    // Update stage to "extracting"
    await supabase
      .from("inbound_emails")
      .update({ classification_stage: "extracting" })
      .eq("id", emailId);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response");
      return null;
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr.trim());
    
    return {
      classification: result.classification,
      confidence: result.confidence,
      tier: "ai",
      extracted_data: result.extracted_data,
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return null;
  }
}

async function classifyWithRules(
  supabase: any,
  businessId: string,
  connectionId: string,
  subject: string,
  body: string,
  fromAddress: string
): Promise<ClassificationResult | null> {
  // Fetch active rules ordered by priority
  const { data: rules, error } = await supabase
    .from("email_rules")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .or(`connection_id.is.null,connection_id.eq.${connectionId}`)
    .order("priority", { ascending: false });

  if (error || !rules?.length) {
    return null;
  }

  const emailData = {
    subject: subject?.toLowerCase() || "",
    body: body?.toLowerCase() || "",
    from: fromAddress?.toLowerCase() || "",
  };

  for (const rule of rules) {
    const conditions = rule.conditions || [];
    let allMatch = true;

    for (const condition of conditions) {
      const { field, operator, value } = condition;
      const fieldValue = emailData[field as keyof typeof emailData] || "";
      const testValue = (value || "").toLowerCase();

      switch (operator) {
        case "contains":
          allMatch = allMatch && fieldValue.includes(testValue);
          break;
        case "not_contains":
          allMatch = allMatch && !fieldValue.includes(testValue);
          break;
        case "equals":
          allMatch = allMatch && fieldValue === testValue;
          break;
        case "starts_with":
          allMatch = allMatch && fieldValue.startsWith(testValue);
          break;
        case "ends_with":
          allMatch = allMatch && fieldValue.endsWith(testValue);
          break;
        default:
          allMatch = false;
      }

      if (!allMatch) break;
    }

    if (allMatch && conditions.length > 0) {
      // Update rule match stats
      await supabase
        .from("email_rules")
        .update({ 
          times_matched: (rule.times_matched || 0) + 1,
          last_matched_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      // Map action to classification
      const classificationMap: Record<string, string> = {
        classify: "service_request",
        spam: "spam",
        ignore: "out_of_scope",
        auto_reply: "inquiry",
      };

      return {
        classification: classificationMap[rule.action] || "inquiry",
        confidence: 0.75,
        tier: "rules",
      };
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_id }: ClassifyRequest = await req.json();

    if (!email_id) {
      return new Response(
        JSON.stringify({ error: "Missing email_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the email
    const { data: email, error: fetchError } = await supabase
      .from("inbound_emails")
      .select("*, email_connections!inner(business_id, classification_threshold, auto_create_requests)")
      .eq("id", email_id)
      .single();

    if (fetchError || !email) {
      console.error("Email not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Classifying email ${email_id}: "${email.subject}"`);

    let result: ClassificationResult | null = null;

    // Tier 1: AI Classification
    result = await classifyWithAI(
      supabase,
      email_id,
      email.subject || "",
      email.body_text || "",
      email.from_address
    );

    // Tier 2: Rules-based classification (if AI fails or low confidence)
    if (!result || result.confidence < 0.6) {
      const rulesResult = await classifyWithRules(
        supabase,
        email.business_id,
        email.connection_id,
        email.subject || "",
        email.body_text || "",
        email.from_address
      );
      
      if (rulesResult && (!result || rulesResult.confidence > result.confidence)) {
        result = rulesResult;
      }
    }

    // Tier 3: Keyword fallback (always succeeds)
    if (!result) {
      result = classifyByKeywords(email.subject || "", email.body_text || "");
    }

    // Update the email with classification results
    const { error: updateError } = await supabase
      .from("inbound_emails")
      .update({
        classification: result.classification,
        classification_confidence: result.confidence,
        classification_tier: result.tier,
        classification_stage: "complete",
        classified_at: new Date().toISOString(),
        ai_extracted_data: result.extracted_data || {},
        status: result.classification === "spam" ? "spam" : "processed",
      })
      .eq("id", email_id);

    if (updateError) {
      console.error("Failed to update email:", updateError);
    }

    console.log(`Email ${email_id} classified as ${result.classification} (${result.tier}, confidence: ${result.confidence})`);

    // Check if we should auto-create a request
    const threshold = email.email_connections?.classification_threshold || 0.85;
    const autoCreate = email.email_connections?.auto_create_requests || false;

    if (
      result.classification === "service_request" &&
      result.confidence >= threshold &&
      autoCreate
    ) {
      console.log(`Auto-creating request for email ${email_id}`);
      
      // Invoke email-to-request function
      await supabase.functions.invoke("email-to-request", {
        body: { email_id },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        classification: result.classification,
        confidence: result.confidence,
        tier: result.tier,
        extracted_data: result.extracted_data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Classification error:", error);
    return new Response(
      JSON.stringify({ error: "Classification failed", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
