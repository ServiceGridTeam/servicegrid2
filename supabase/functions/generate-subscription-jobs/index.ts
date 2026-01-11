import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateRunId = () => `job_gen_${Date.now()}_${Math.random().toString(36).substring(7)}`;

function log(level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "generate-subscription-jobs",
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
      .eq('lock_name', 'generate-subscription-jobs')
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
      lock_name: 'generate-subscription-jobs',
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
        schedules_processed: 0,
        jobs_created: 0,
        failed: 0,
        schedules_regenerated: 0,
        errors: [] as string[],
      };

      // Calculate date range: today to 7 days out
      const today = new Date();
      const lookaheadDate = new Date();
      lookaheadDate.setDate(lookaheadDate.getDate() + 7);
      
      const todayStr = today.toISOString().split('T')[0];
      const lookaheadStr = lookaheadDate.toISOString().split('T')[0];

      log("info", "fetching_schedules", { 
        run_id: runId, 
        date_from: todayStr, 
        date_to: lookaheadStr 
      });

      // Fetch pending schedules that need job generation
      const { data: schedules, error: fetchError } = await supabase
        .from('subscription_schedules')
        .select(`
          id,
          subscription_id,
          scheduled_date,
          status,
          subscription:subscriptions!inner(
            id,
            customer_id,
            service_plan_id,
            status,
            business_id,
            notes,
            service_plan:service_plans!inner(
              id,
              name,
              default_duration_minutes
            )
          )
        `)
        .eq('status', 'pending')
        .lte('scheduled_date', lookaheadStr)
        .gte('scheduled_date', todayStr)
        .eq('subscription.status', 'active')
        .order('scheduled_date', { ascending: true })
        .limit(50);

      if (fetchError) {
        log("error", "fetch_schedules_error", { run_id: runId, error: fetchError.message });
        throw fetchError;
      }

      log("info", "schedules_found", { run_id: runId, count: schedules?.length || 0 });

      // Process each schedule
      for (const schedule of schedules || []) {
        results.schedules_processed++;
        
        try {
          // Call the generate_subscription_job RPC
          const { data: jobData, error: rpcError } = await supabase.rpc('generate_subscription_job', {
            p_schedule_id: schedule.id
          });

          if (rpcError) {
            log("warn", "job_generation_failed", { 
              run_id: runId, 
              schedule_id: schedule.id,
              error: rpcError.message 
            });
            results.failed++;
            results.errors.push(`Schedule ${schedule.id}: ${rpcError.message}`);
            continue;
          }

          results.jobs_created++;
          log("info", "job_created", { 
            run_id: runId, 
            schedule_id: schedule.id,
            job_id: jobData 
          });

          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          log("error", "job_generation_exception", { 
            run_id: runId, 
            schedule_id: schedule.id,
            error: errorMessage 
          });
          results.failed++;
          results.errors.push(`Schedule ${schedule.id}: ${errorMessage}`);
        }
      }

      // Regenerate rolling 3-month schedules for all active subscriptions
      log("info", "regenerating_schedules", { run_id: runId });
      
      const { error: regenError } = await supabase.rpc('generate_schedules_for_active_subscriptions');
      
      if (regenError) {
        log("warn", "schedule_regeneration_failed", { run_id: runId, error: regenError.message });
      } else {
        log("info", "schedules_regenerated", { run_id: runId });
        results.schedules_regenerated = 1;
      }

      // Record metrics
      await supabase.from('subscription_metrics').insert({
        business_id: null, // System-wide metric
        metric_type: 'job_generation_run',
        metric_date: todayStr,
        metric_value: results.jobs_created,
        metadata: {
          run_id: runId,
          schedules_processed: results.schedules_processed,
          jobs_created: results.jobs_created,
          failed: results.failed,
          duration_ms: Date.now() - startTime,
        },
      });

      // Release lock
      await supabase.from('cron_locks').delete().eq('lock_name', 'generate-subscription-jobs');

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
      await supabase.from('cron_locks').delete().eq('lock_name', 'generate-subscription-jobs');
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
