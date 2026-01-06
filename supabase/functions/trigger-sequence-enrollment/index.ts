import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrollmentRequest {
  trigger_type: string;
  customer_id: string;
  business_id: string;
  metadata?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { trigger_type, customer_id, business_id, metadata = {} }: EnrollmentRequest = await req.json();

    console.log(`Processing trigger: ${trigger_type} for customer ${customer_id} in business ${business_id}`);

    if (!trigger_type || !customer_id || !business_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: trigger_type, customer_id, business_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get customer and verify they can receive emails
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, email, email_status, marketing_consent")
      .eq("id", customer_id)
      .eq("business_id", business_id)
      .single();

    if (customerError || !customer) {
      console.log(`Customer ${customer_id} not found`);
      return new Response(
        JSON.stringify({ error: "Customer not found", enrolled: 0 }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!customer.email) {
      console.log(`Customer ${customer_id} has no email`);
      return new Response(
        JSON.stringify({ message: "Customer has no email address", enrolled: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (customer.email_status === "unsubscribed" || customer.email_status === "bounced") {
      console.log(`Customer ${customer_id} email_status is ${customer.email_status}`);
      return new Response(
        JSON.stringify({ message: `Customer email status is ${customer.email_status}`, enrolled: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find active sequences matching this trigger
    const { data: sequences, error: sequencesError } = await supabase
      .from("email_sequences")
      .select(`
        id,
        name,
        trigger_type,
        trigger_config,
        sequence_steps (
          id,
          step_order,
          delay_days,
          delay_hours,
          is_active
        )
      `)
      .eq("business_id", business_id)
      .eq("trigger_type", trigger_type)
      .eq("status", "active");

    if (sequencesError) {
      console.error("Error fetching sequences:", sequencesError);
      throw sequencesError;
    }

    if (!sequences || sequences.length === 0) {
      console.log(`No active sequences found for trigger ${trigger_type}`);
      return new Response(
        JSON.stringify({ message: "No matching sequences found", enrolled: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${sequences.length} sequences for trigger ${trigger_type}`);

    const enrollments: string[] = [];
    const skipped: string[] = [];

    for (const sequence of sequences) {
      // Check if customer is already enrolled in this sequence
      const { data: existingEnrollment } = await supabase
        .from("sequence_enrollments")
        .select("id")
        .eq("sequence_id", sequence.id)
        .eq("customer_id", customer_id)
        .in("status", ["active", "paused"])
        .single();

      if (existingEnrollment) {
        console.log(`Customer ${customer_id} already enrolled in sequence ${sequence.id}`);
        skipped.push(sequence.id);
        continue;
      }

      // Get the first active step
      const activeSteps = (sequence.sequence_steps || [])
        .filter((s: { is_active: boolean }) => s.is_active)
        .sort((a: { step_order: number }, b: { step_order: number }) => a.step_order - b.step_order);

      if (activeSteps.length === 0) {
        console.log(`Sequence ${sequence.id} has no active steps`);
        skipped.push(sequence.id);
        continue;
      }

      const firstStep = activeSteps[0];

      // Calculate first email time
      const nextEmailAt = new Date();
      nextEmailAt.setDate(nextEmailAt.getDate() + (firstStep.delay_days || 0));
      nextEmailAt.setHours(nextEmailAt.getHours() + (firstStep.delay_hours || 0));

      // Create enrollment
      const { data: newEnrollment, error: enrollError } = await supabase
        .from("sequence_enrollments")
        .insert({
          sequence_id: sequence.id,
          business_id: business_id,
          customer_id: customer_id,
          current_step: firstStep.step_order,
          status: "active",
          next_email_at: nextEmailAt.toISOString(),
          metadata: { trigger: trigger_type, ...metadata },
        })
        .select()
        .single();

      if (enrollError) {
        console.error(`Error enrolling in sequence ${sequence.id}:`, enrollError);
        continue;
      }

      console.log(`Enrolled customer ${customer_id} in sequence ${sequence.name} (${sequence.id}), first email at ${nextEmailAt.toISOString()}`);
      enrollments.push(sequence.id);

      // Increment sequence enrollment_count
      await supabase
        .from("email_sequences")
        .update({ enrollment_count: (sequence as any).enrollment_count + 1 || 1 })
        .eq("id", sequence.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        enrolled: enrollments.length,
        skipped: skipped.length,
        sequence_ids: enrollments,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in trigger-sequence-enrollment:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
