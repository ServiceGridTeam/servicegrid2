import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") || "https://wzglfwcftigofbuojeci.lovableproject.com";

interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  business_id: string;
  customer_id: string;
  current_step: number;
  status: string;
  next_email_at: string | null;
  customers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    email_status: string | null;
    company_name: string | null;
  };
  email_sequences: {
    id: string;
    name: string;
    status: string;
    business_id: string;
  };
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  template_id: string;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  subject_override: string | null;
  is_active: boolean;
  email_templates: {
    id: string;
    name: string;
    subject: string;
    body_html: string;
  } | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting sequence email processing...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    if (!resendApiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const now = new Date().toISOString();

    // Find enrollments that are due for their next email
    const { data: pendingEnrollments, error: fetchError } = await supabase
      .from("sequence_enrollments")
      .select(`
        id,
        sequence_id,
        business_id,
        customer_id,
        current_step,
        status,
        next_email_at,
        customers (
          id,
          first_name,
          last_name,
          email,
          email_status,
          company_name
        ),
        email_sequences (
          id,
          name,
          status,
          business_id
        )
      `)
      .eq("status", "active")
      .lte("next_email_at", now)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching pending enrollments:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingEnrollments?.length || 0} pending sequence emails`);

    const results = {
      processed: 0,
      sent: 0,
      skipped: 0,
      completed: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (!pendingEnrollments || pendingEnrollments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending sequence emails", results }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    for (const enrollment of pendingEnrollments as unknown as SequenceEnrollment[]) {
      results.processed++;
      console.log(`Processing enrollment ${enrollment.id} for customer ${enrollment.customer_id}`);

      try {
        // Skip if sequence is not active
        if (enrollment.email_sequences?.status !== "active") {
          console.log(`Skipping: sequence ${enrollment.sequence_id} is not active`);
          results.skipped++;
          continue;
        }

        // Skip if customer has unsubscribed or bounced
        const customer = enrollment.customers;
        if (!customer?.email) {
          console.log(`Skipping: customer ${enrollment.customer_id} has no email`);
          results.skipped++;
          continue;
        }

        if (customer.email_status === "unsubscribed" || customer.email_status === "bounced") {
          console.log(`Skipping: customer ${enrollment.customer_id} email_status is ${customer.email_status}`);
          // Pause the enrollment
          await supabase
            .from("sequence_enrollments")
            .update({ status: "paused", paused_at: now, exit_reason: `customer_${customer.email_status}` })
            .eq("id", enrollment.id);
          results.skipped++;
          continue;
        }

        // Check email_preferences for subscribed_sequences
        const { data: prefs } = await supabase
          .from("email_preferences")
          .select("subscribed_sequences, preference_token")
          .eq("customer_id", enrollment.customer_id)
          .eq("business_id", enrollment.business_id)
          .single();

        if (prefs && prefs.subscribed_sequences === false) {
          console.log(`Skipping: customer ${enrollment.customer_id} unsubscribed from sequences`);
          await supabase
            .from("sequence_enrollments")
            .update({ status: "paused", paused_at: now, exit_reason: "unsubscribed_sequences" })
            .eq("id", enrollment.id);
          results.skipped++;
          continue;
        }

        // Get or create preference_token for unsubscribe link
        let preferenceToken = prefs?.preference_token;
        if (!preferenceToken) {
          // Create email_preferences record with a new token
          preferenceToken = crypto.randomUUID();
          await supabase.from("email_preferences").insert({
            business_id: enrollment.business_id,
            customer_id: enrollment.customer_id,
            preference_token: preferenceToken,
            subscribed_marketing: true,
            subscribed_sequences: true,
            subscribed_transactional: true,
          });
          console.log(`Created new preference token for customer ${enrollment.customer_id}`);
        }

        const preferencesLink = `${SITE_URL}/email-preferences/${preferenceToken}`;
        const unsubscribeLink = preferencesLink;

        // Get all steps for this sequence
        const { data: steps, error: stepsError } = await supabase
          .from("sequence_steps")
          .select(`
            id,
            sequence_id,
            template_id,
            step_order,
            delay_days,
            delay_hours,
            subject_override,
            is_active,
            email_templates (
              id,
              name,
              subject,
              body_html
            )
          `)
          .eq("sequence_id", enrollment.sequence_id)
          .eq("is_active", true)
          .order("step_order", { ascending: true });

        if (stepsError || !steps || steps.length === 0) {
          console.log(`Skipping: no active steps for sequence ${enrollment.sequence_id}`);
          results.skipped++;
          continue;
        }

        const typedSteps = steps as unknown as SequenceStep[];

        // Find current step
        const currentStepData = typedSteps.find(s => s.step_order === enrollment.current_step);
        if (!currentStepData) {
          console.log(`Skipping: step ${enrollment.current_step} not found in sequence`);
          results.skipped++;
          continue;
        }

        if (!currentStepData.email_templates) {
          console.log(`Skipping: no template for step ${currentStepData.id}`);
          results.skipped++;
          continue;
        }

        // Get business info for branding
        const { data: business } = await supabase
          .from("businesses")
          .select("name, email")
          .eq("id", enrollment.business_id)
          .single();

        // Render the template with customer data
        const template = currentStepData.email_templates;
        const subject = currentStepData.subject_override || template.subject;
        
        // Replace template variables including unsubscribe links
        const variables: Record<string, string> = {
          customer_first_name: customer.first_name || "",
          customer_last_name: customer.last_name || "",
          customer_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
          customer_email: customer.email,
          customer_company: customer.company_name || "",
          business_name: business?.name || "",
          current_year: new Date().getFullYear().toString(),
          unsubscribe_link: unsubscribeLink,
          preferences_link: preferencesLink,
        };

        let renderedSubject = subject;
        let renderedBody = template.body_html;

        for (const [key, value] of Object.entries(variables)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
          renderedSubject = renderedSubject.replace(regex, value);
          renderedBody = renderedBody.replace(regex, value);
        }

        // Wrap body in HTML structure with unsubscribe footer
        const htmlEmail = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border-radius: 8px;">
              ${renderedBody}
            </div>
            <div style="max-width: 600px; margin: 20px auto; text-align: center; color: #666; font-size: 12px;">
              <p>${business?.name || "ServiceGrid"}</p>
              <p style="margin-top: 16px;">
                <a href="${unsubscribeLink}" style="color: #666; text-decoration: underline;">Unsubscribe</a>
                &nbsp;|&nbsp;
                <a href="${preferencesLink}" style="color: #666; text-decoration: underline;">Email Preferences</a>
              </p>
            </div>
          </body>
          </html>
        `;

        // Send the email via Resend
        const fromEmail = business?.email || "onboarding@resend.dev";
        const fromName = business?.name || "ServiceGrid";

        const emailResponse = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [customer.email],
          subject: renderedSubject,
          html: htmlEmail,
        });

        console.log(`Email sent to ${customer.email}:`, emailResponse);

        // Create email_sends record
        await supabase.from("email_sends").insert({
          business_id: enrollment.business_id,
          customer_id: enrollment.customer_id,
          sequence_id: enrollment.sequence_id,
          enrollment_id: enrollment.id,
          step_id: currentStepData.id,
          template_id: currentStepData.template_id,
          email_type: "sequence",
          to_email: customer.email,
          to_name: `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
          subject: renderedSubject,
          resend_id: emailResponse.data?.id || null,
          status: "sent",
          sent_at: now,
        });

        // Increment total_sent on sequence step
        const { data: stepData } = await supabase
          .from("sequence_steps")
          .select("total_sent")
          .eq("id", currentStepData.id)
          .single();
        
        await supabase
          .from("sequence_steps")
          .update({ total_sent: (stepData?.total_sent || 0) + 1 })
          .eq("id", currentStepData.id);

        // Check if this was the last step
        const nextStepIndex = typedSteps.findIndex(s => s.step_order > enrollment.current_step);
        
        if (nextStepIndex === -1) {
          // This was the last step - mark enrollment as completed
          await supabase
            .from("sequence_enrollments")
            .update({ 
              status: "completed", 
              completed_at: now,
              next_email_at: null
            })
            .eq("id", enrollment.id);

          console.log(`Enrollment ${enrollment.id} completed`);

          // Increment sequence completed_count
          const { data: currentSeq } = await supabase
            .from("email_sequences")
            .select("completed_count")
            .eq("id", enrollment.sequence_id)
            .single();
          
          await supabase
            .from("email_sequences")
            .update({ completed_count: (currentSeq?.completed_count || 0) + 1 })
            .eq("id", enrollment.sequence_id);

          results.completed++;
        } else {
          // Calculate next_email_at for the next step
          const nextStep = typedSteps[nextStepIndex];
          const nextEmailAt = new Date();
          nextEmailAt.setDate(nextEmailAt.getDate() + nextStep.delay_days);
          nextEmailAt.setHours(nextEmailAt.getHours() + nextStep.delay_hours);

          await supabase
            .from("sequence_enrollments")
            .update({ 
              current_step: nextStep.step_order,
              next_email_at: nextEmailAt.toISOString()
            })
            .eq("id", enrollment.id);

          console.log(`Enrollment ${enrollment.id} moved to step ${nextStep.step_order}, next email at ${nextEmailAt.toISOString()}`);
        }

        results.sent++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        results.failed++;
        results.errors.push(`${enrollment.id}: ${errorMessage}`);
      }
    }

    console.log(`Sequence processing complete. Sent: ${results.sent}, Completed: ${results.completed}, Skipped: ${results.skipped}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} sequence enrollments`,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-sequence-emails:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
