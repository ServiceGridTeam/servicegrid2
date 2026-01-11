import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateRunId = () => `inv_gen_${Date.now()}_${Math.random().toString(36).substring(7)}`;

function log(level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "generate-subscription-invoices",
    level,
    event,
    ...data,
  }));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = generateRunId();
  const startTime = Date.now();
  
  log("info", "cron_start", { run_id: runId });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Clean up expired locks
    await supabase.from('cron_locks').delete().lt('expires_at', new Date().toISOString());
    
    // Check for existing lock
    const { data: existingLock } = await supabase
      .from('cron_locks')
      .select('lock_name, locked_by')
      .eq('lock_name', 'generate-subscription-invoices')
      .single();

    if (existingLock) {
      log("info", "lock_skipped", { run_id: runId, held_by: existingLock.locked_by });
      return new Response(
        JSON.stringify({ success: true, message: "Skipped - another instance running" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Acquire lock (5 minute TTL)
    const { error: lockError } = await supabase.from('cron_locks').insert({
      lock_name: 'generate-subscription-invoices',
      locked_by: runId,
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    if (lockError) {
      log("warn", "lock_failed", { run_id: runId, error: lockError.message });
      return new Response(
        JSON.stringify({ success: false, message: "Failed to acquire lock" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    try {
      const results = {
        prepay_invoices_created: 0,
        per_visit_invoices_created: 0,
        failed: 0,
        errors: [] as string[],
      };

      const todayStr = new Date().toISOString().split('T')[0];

      // ===== PART 1: Process prepay subscriptions =====
      log("info", "processing_prepay_subscriptions", { run_id: runId });

      // Find active prepay subscriptions due for billing
      const { data: prepaySubscriptions, error: prepayError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          customer_id,
          business_id,
          service_plan_id,
          billing_model,
          next_billing_date,
          service_plan:service_plans!inner(
            id,
            name,
            price
          )
        `)
        .eq('status', 'active')
        .eq('billing_model', 'prepay')
        .lte('next_billing_date', todayStr)
        .limit(50);

      if (prepayError) {
        log("error", "fetch_prepay_error", { run_id: runId, error: prepayError.message });
      } else {
        log("info", "prepay_subscriptions_found", { run_id: runId, count: prepaySubscriptions?.length || 0 });

        for (const subscription of prepaySubscriptions || []) {
          try {
            // Call the generate_subscription_invoice RPC
            const { data: invoiceData, error: rpcError } = await supabase.rpc('generate_subscription_invoice', {
              p_subscription_id: subscription.id
            });

            if (rpcError) {
              log("warn", "prepay_invoice_failed", { 
                run_id: runId, 
                subscription_id: subscription.id,
                error: rpcError.message 
              });
              results.failed++;
              results.errors.push(`Prepay ${subscription.id}: ${rpcError.message}`);
              continue;
            }

            results.prepay_invoices_created++;
            log("info", "prepay_invoice_created", { 
              run_id: runId, 
              subscription_id: subscription.id,
              invoice_id: invoiceData 
            });

            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            log("error", "prepay_invoice_exception", { 
              run_id: runId, 
              subscription_id: subscription.id,
              error: errorMessage 
            });
            results.failed++;
            results.errors.push(`Prepay ${subscription.id}: ${errorMessage}`);
          }
        }
      }

      // ===== PART 2: Process per-visit subscriptions (completed jobs) =====
      log("info", "processing_per_visit_jobs", { run_id: runId });

      // Find completed subscription jobs that need invoicing
      const { data: completedJobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          business_id,
          customer_id,
          subscription_id,
          status,
          subscription:subscriptions!inner(
            id,
            billing_model,
            service_plan:service_plans!inner(
              id,
              name,
              price
            )
          )
        `)
        .eq('status', 'completed')
        .not('subscription_id', 'is', null)
        .is('invoice_id', null)
        .eq('subscription.billing_model', 'per_visit')
        .limit(50);

      if (jobsError) {
        log("error", "fetch_jobs_error", { run_id: runId, error: jobsError.message });
      } else {
        log("info", "per_visit_jobs_found", { run_id: runId, count: completedJobs?.length || 0 });

        for (const job of completedJobs || []) {
          try {
            // Create invoice for this job
            // First, get the price from the subscription's service plan
            // Note: subscription is returned as an object from the join
            const subscriptionData = job.subscription as unknown as { 
              id: string; 
              billing_model: string;
              service_plan: { id: string; name: string; price: number } 
            };
            const price = subscriptionData?.service_plan?.price || 0;
            const servicePlanName = subscriptionData?.service_plan?.name || 'Service';

            // Generate invoice number
            const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

            // Create the invoice
            const { data: invoiceData, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                business_id: job.business_id,
                customer_id: job.customer_id,
                invoice_number: invoiceNumber,
                status: 'draft',
                subtotal: price,
                tax_amount: 0,
                discount_amount: 0,
                total: price,
                balance_due: price,
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                notes: `Invoice for subscription service: ${servicePlanName}`,
              })
              .select('id')
              .single();

            if (invoiceError) {
              log("warn", "per_visit_invoice_failed", { 
                run_id: runId, 
                job_id: job.id,
                error: invoiceError.message 
              });
              results.failed++;
              results.errors.push(`Job ${job.id}: ${invoiceError.message}`);
              continue;
            }

            // Link job to invoice
            await supabase
              .from('jobs')
              .update({ invoice_id: invoiceData.id })
              .eq('id', job.id);

            // Record subscription event
            await supabase.from('subscription_events').insert({
              subscription_id: job.subscription_id,
              event_type: 'invoice_generated',
              event_data: {
                invoice_id: invoiceData.id,
                job_id: job.id,
                amount: price,
              },
            });

            results.per_visit_invoices_created++;
            log("info", "per_visit_invoice_created", { 
              run_id: runId, 
              job_id: job.id,
              invoice_id: invoiceData.id 
            });

            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            log("error", "per_visit_invoice_exception", { 
              run_id: runId, 
              job_id: job.id,
              error: errorMessage 
            });
            results.failed++;
            results.errors.push(`Job ${job.id}: ${errorMessage}`);
          }
        }
      }

      // Record metrics
      await supabase.from('subscription_metrics').insert({
        business_id: null,
        metric_type: 'invoice_generation_run',
        metric_date: todayStr,
        metric_value: results.prepay_invoices_created + results.per_visit_invoices_created,
        metadata: {
          run_id: runId,
          prepay_invoices: results.prepay_invoices_created,
          per_visit_invoices: results.per_visit_invoices_created,
          failed: results.failed,
          duration_ms: Date.now() - startTime,
        },
      });

      // Release lock
      await supabase.from('cron_locks').delete().eq('lock_name', 'generate-subscription-invoices');

      log("info", "cron_complete", { 
        run_id: runId, 
        duration_ms: Date.now() - startTime,
        results 
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          results, 
          run_id: runId, 
          duration_ms: Date.now() - startTime 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );

    } catch (innerError) {
      // Always release lock on error
      await supabase.from('cron_locks').delete().eq('lock_name', 'generate-subscription-invoices');
      throw innerError;
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("error", "cron_error", { run_id: runId, error: errorMessage });
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, run_id: runId }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
