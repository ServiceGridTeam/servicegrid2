import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailToRequestPayload {
  email_id: string;
  override_data?: {
    customer_name?: string;
    customer_phone?: string;
    service_type?: string;
    description?: string;
    urgency?: string;
    address?: {
      line1?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
}

function mapUrgency(urgency: string | null): string {
  const mapping: Record<string, string> = {
    emergency: "emergency",
    high: "urgent",
    normal: "normal",
    low: "low",
  };
  return mapping[urgency?.toLowerCase() || ""] || "normal";
}

function generateRequestNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${timestamp}-${random}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email_id, override_data }: EmailToRequestPayload = await req.json();

    if (!email_id) {
      return new Response(
        JSON.stringify({ error: "Missing email_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the email with connection info
    const { data: email, error: fetchError } = await supabase
      .from("inbound_emails")
      .select(`
        *,
        email_connections!inner(
          business_id,
          auto_acknowledge
        )
      `)
      .eq("id", email_id)
      .single();

    if (fetchError || !email) {
      console.error("Email not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if request already exists for this email
    if (email.job_request_id) {
      return new Response(
        JSON.stringify({ error: "Request already exists for this email", request_id: email.job_request_id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessId = email.email_connections.business_id;
    const extracted = email.ai_extracted_data || {};

    // Try to find existing customer by email
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, first_name, last_name, phone, address_line1, city, state, zip")
      .eq("business_id", businessId)
      .ilike("email", email.from_address)
      .limit(1)
      .single();

    // Parse customer name from extracted data or email
    let customerName = override_data?.customer_name || extracted.customer_name || email.from_name || "";
    if (!customerName && email.from_address) {
      // Use email prefix as fallback name
      customerName = email.from_address.split("@")[0].replace(/[._-]/g, " ");
    }

    // Build request data
    const requestData = {
      business_id: businessId,
      request_number: generateRequestNumber(),
      source: "email" as const,
      source_email_id: email_id,
      source_email_thread_id: email.thread_id,
      status: "pending" as const,
      
      // Customer info
      customer_id: existingCustomer?.id || null,
      customer_name: customerName,
      customer_email: email.from_address,
      customer_phone: override_data?.customer_phone || extracted.phone || existingCustomer?.phone || null,
      
      // Service info
      service_type: override_data?.service_type || extracted.service_type || null,
      description: override_data?.description || extracted.issue_description || email.subject || "Service request from email",
      urgency: mapUrgency(override_data?.urgency || extracted.urgency),
      
      // Address (from extraction, override, or existing customer)
      address_line1: override_data?.address?.line1 || extracted.address || existingCustomer?.address_line1 || null,
      city: override_data?.address?.city || existingCustomer?.city || null,
      state: override_data?.address?.state || existingCustomer?.state || null,
      zip: override_data?.address?.zip || existingCustomer?.zip || null,
      
      // Metadata
      notes: `Created from email: ${email.subject}\n\nOriginal email from: ${email.from_address}`,
    };

    console.log("Creating job request:", requestData);

    // Create the job request
    const { data: jobRequest, error: insertError } = await supabase
      .from("job_requests")
      .insert(requestData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create job request:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create request", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the email with the request link
    await supabase
      .from("inbound_emails")
      .update({
        job_request_id: jobRequest.id,
        status: "request_created",
      })
      .eq("id", email_id);

    console.log(`Created job request ${jobRequest.id} from email ${email_id}`);

    // Send auto-acknowledge if enabled
    if (email.email_connections.auto_acknowledge) {
      try {
        // Fetch business info for email
        const { data: business } = await supabase
          .from("businesses")
          .select("name, email")
          .eq("id", businessId)
          .single();

        if (business) {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: `${business.name} <${business.email || "noreply@servicegrid.app"}>`,
                to: email.from_address,
                subject: `Re: ${email.subject || "Your Service Request"}`,
                text: `Hi ${customerName},

Thank you for reaching out! We've received your service request and our team will review it shortly.

Your request number is: ${jobRequest.request_number}

We'll be in touch soon with next steps.

Best regards,
${business.name} Team`,
              }),
            });
            console.log(`Auto-acknowledge email sent to ${email.from_address}`);
          }
        }
      } catch (ackError) {
        console.error("Failed to send auto-acknowledge:", ackError);
        // Don't fail the request creation if acknowledge fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: jobRequest.id,
        request_number: jobRequest.request_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email to request error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create request", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
