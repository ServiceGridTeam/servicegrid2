import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") || "https://wzglfwcftigofbuojeci.lovableproject.com";

interface RenderRequest {
  template_id: string;
  customer_id?: string;
  sample_data?: Record<string, string>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header and verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { template_id, customer_id, sample_data }: RenderRequest = await req.json();

    if (!template_id) {
      return new Response(JSON.stringify({ error: "template_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's business
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: "No business found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get template
    const { data: template, error: templateError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", template_id)
      .eq("business_id", profile.business_id)
      .single();

    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get business info for branding
    const { data: business } = await supabase
      .from("businesses")
      .select("name, email, phone")
      .eq("id", profile.business_id)
      .single();

    // Sample unsubscribe/preferences links for preview
    const samplePreferenceToken = "sample-preview-token";
    const samplePreferencesLink = `${SITE_URL}/email-preferences/${samplePreferenceToken}`;
    const sampleUnsubscribeLink = samplePreferencesLink;

    // Build variable values
    let variables: Record<string, string> = {
      business_name: business?.name || "Your Business",
      business_email: business?.email || "",
      business_phone: business?.phone || "",
      current_date: new Date().toLocaleDateString(),
      current_year: new Date().getFullYear().toString(),
      unsubscribe_link: sampleUnsubscribeLink,
      preferences_link: samplePreferencesLink,
      ...sample_data,
    };

    // If customer_id provided, get real customer data
    if (customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customer_id)
        .eq("business_id", profile.business_id)
        .single();

      if (customer) {
        // Check if customer has a preference token
        const { data: prefs } = await supabase
          .from("email_preferences")
          .select("preference_token")
          .eq("customer_id", customer_id)
          .single();

        const realPreferencesLink = prefs?.preference_token 
          ? `${SITE_URL}/email-preferences/${prefs.preference_token}`
          : samplePreferencesLink;

        variables = {
          ...variables,
          customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "",
          customer_first_name: customer.first_name || "",
          customer_last_name: customer.last_name || "",
          customer_email: customer.email || "",
          customer_phone: customer.phone || "",
          customer_company: customer.company_name || "",
          unsubscribe_link: realPreferencesLink,
          preferences_link: realPreferencesLink,
        };
      }
    } else {
      // Use sample data for preview
      variables = {
        ...variables,
        customer_name: sample_data?.customer_name || "John Smith",
        customer_first_name: sample_data?.customer_first_name || "John",
        customer_last_name: sample_data?.customer_last_name || "Smith",
        customer_email: sample_data?.customer_email || "john@example.com",
        customer_phone: sample_data?.customer_phone || "(555) 123-4567",
        customer_company: sample_data?.customer_company || "Example Corp",
      };
    }

    // Replace variables in subject and body
    let renderedSubject = template.subject || "";
    let renderedBody = template.body_html || "";

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
      renderedSubject = renderedSubject.replace(regex, value);
      renderedBody = renderedBody.replace(regex, value);
    }

    // Wrap in email container HTML with unsubscribe footer
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    h1, h2, h3 { color: #111; margin-top: 0; }
    a { color: #2563eb; }
    p { margin: 0 0 16px 0; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .unsubscribe-footer {
      margin-top: 20px;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .unsubscribe-footer a {
      color: #666;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${renderedBody}
    <div class="footer">
      <p>${business?.name || "Your Business"}</p>
      ${business?.email ? `<p>${business.email}</p>` : ""}
      ${business?.phone ? `<p>${business.phone}</p>` : ""}
    </div>
  </div>
  <div class="unsubscribe-footer">
    <a href="${variables.unsubscribe_link}">Unsubscribe</a>
    &nbsp;|&nbsp;
    <a href="${variables.preferences_link}">Email Preferences</a>
  </div>
</body>
</html>`;

    console.log(`Rendered template ${template_id} for preview`);

    return new Response(
      JSON.stringify({
        subject: renderedSubject,
        body: renderedBody,
        html: fullHtml,
        variables_used: Object.keys(variables),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error rendering template:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
