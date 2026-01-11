import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const generateRunId = () => `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

const sanitizeForLog = (data: Record<string, unknown>): Record<string, unknown> => {
  const sensitiveFields = ['email', 'phone', 'name', 'address', 'customer_email'];
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (sanitized[field]) sanitized[field] = '[REDACTED]';
  }
  return sanitized;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: number;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const runId = generateRunId();
  const startTime = Date.now();
  
  console.log(JSON.stringify({ level: 'info', event: 'cron_start', run_id: runId, timestamp: new Date().toISOString() }));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Missing Supabase environment variables");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Simple lock check - delete expired locks first
    await supabase.from('cron_locks').delete().lt('expires_at', new Date().toISOString());
    
    const { data: existingLock } = await supabase
      .from('cron_locks')
      .select('lock_name')
      .eq('lock_name', 'process-overdue-reminders')
      .single();

    if (existingLock) {
      console.log(JSON.stringify({ level: 'info', event: 'lock_skipped', run_id: runId }));
      return new Response(JSON.stringify({ success: true, message: "Skipped - another instance running" }), 
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Acquire lock
    await supabase.from('cron_locks').insert({
      lock_name: 'process-overdue-reminders',
      locked_by: runId,
      expires_at: new Date(Date.now() + 300000).toISOString(),
    });

    try {
      const { data: rules, error: rulesError } = await supabase
        .from('automation_rules')
        .select('id, business_id, name, trigger_type, action_type, action_config')
        .eq('trigger_type', 'invoice_overdue')
        .eq('action_type', 'send_reminder_email')
        .eq('is_active', true)
        .is('deleted_at', null);

      if (rulesError) throw rulesError;

      const results = { processed: 0, sent: 0, failed: 0, skipped: 0, rules_processed: 0 };

      if (!rules || rules.length === 0) {
        await supabase.from('cron_locks').delete().eq('lock_name', 'process-overdue-reminders');
        return new Response(JSON.stringify({ success: true, message: "No active automation rules", results }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      for (const rule of rules) {
        const config = rule.action_config as { interval_days?: number; max_reminders?: number } || {};
        const intervalDays = config.interval_days || 3;
        const maxReminders = config.max_reminders || 3;
        
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        const reminderThreshold = new Date();
        reminderThreshold.setDate(reminderThreshold.getDate() - intervalDays);

        const { data: overdueInvoices, error: fetchError } = await supabase
          .from("invoices")
          .select("id, invoice_number, customer_id, balance_due, business_id, reminder_count, due_date")
          .eq("business_id", rule.business_id)
          .eq("status", "sent")
          .lt("due_date", todayStr)
          .gt("balance_due", 0)
          .lt("reminder_count", maxReminders)
          .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${reminderThreshold.toISOString()}`)
          .limit(100);

        if (fetchError) continue;

        for (const invoice of overdueInvoices || []) {
          results.processed++;
          const idempotencyKey = `${runId}_${invoice.id}`;

          try {
            const { error: sendError } = await withTimeout(
              supabase.functions.invoke("send-reminder-email", { body: { invoice_id: invoice.id } }),
              30000, `Timeout for invoice ${invoice.invoice_number}`
            );

            if (sendError) throw sendError;

            await supabase.from("invoices").update({
              last_reminder_sent_at: new Date().toISOString(),
              reminder_count: (invoice.reminder_count || 0) + 1
            }).eq("id", invoice.id);

            await supabase.from('automation_logs').insert({
              business_id: rule.business_id, rule_id: rule.id, rule_name: rule.name,
              trigger_type: rule.trigger_type, action_type: rule.action_type,
              target_type: 'invoice', target_id: invoice.id, status: 'success',
              result: sanitizeForLog({ invoice_number: invoice.invoice_number, reminder_count: (invoice.reminder_count || 0) + 1 }),
              idempotency_key: idempotencyKey, cron_run_id: runId
            });

            results.sent++;
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await supabase.from('automation_logs').insert({
              business_id: rule.business_id, rule_id: rule.id, rule_name: rule.name,
              trigger_type: rule.trigger_type, action_type: rule.action_type,
              target_type: 'invoice', target_id: invoice.id, status: 'failed',
              result: sanitizeForLog({ error: errorMessage }),
              idempotency_key: idempotencyKey, cron_run_id: runId
            });
            results.failed++;
          }
        }

        await supabase.from('automation_rules').update({ last_executed_at: new Date().toISOString() }).eq('id', rule.id);
        results.rules_processed++;
      }

      await supabase.from('cron_locks').delete().eq('lock_name', 'process-overdue-reminders');

      return new Response(JSON.stringify({ success: true, results, run_id: runId, duration_ms: Date.now() - startTime }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

    } catch (innerError) {
      await supabase.from('cron_locks').delete().eq('lock_name', 'process-overdue-reminders');
      throw innerError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: 'error', event: 'cron_error', run_id: runId, error: errorMessage }));
    return new Response(JSON.stringify({ success: false, error: errorMessage, run_id: runId }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
