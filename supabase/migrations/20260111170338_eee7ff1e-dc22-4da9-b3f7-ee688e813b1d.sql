-- Fix RLS on cron_locks table (service role only)
ALTER TABLE cron_locks ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for cron_locks - service role only access

-- Fix function search paths for security
CREATE OR REPLACE FUNCTION validate_automation_rule_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trigger_type = 'invoice_overdue' AND NEW.action_type = 'send_reminder_email' THEN
    IF NEW.action_config ? 'interval_days' THEN
      IF NOT (NEW.action_config->>'interval_days')::int IN (3, 5, 7, 14) THEN
        RAISE EXCEPTION 'interval_days must be 3, 5, 7, or 14';
      END IF;
    END IF;
    IF NEW.action_config ? 'max_reminders' THEN
      IF (NEW.action_config->>'max_reminders')::int < 1 
         OR (NEW.action_config->>'max_reminders')::int > 10 THEN
        RAISE EXCEPTION 'max_reminders must be between 1 and 10';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION cleanup_automation_data()
RETURNS jsonb AS $$
DECLARE
  v_logs_deleted integer := 0;
  v_queue_deleted integer := 0;
  v_rules_deleted integer := 0;
BEGIN
  DELETE FROM automation_logs WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
  
  DELETE FROM automation_failed_queue 
  WHERE status = 'exhausted' AND created_at < now() - INTERVAL '30 days';
  DELETE FROM automation_failed_queue 
  WHERE status = 'resolved' AND resolved_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_queue_deleted = ROW_COUNT;
  
  DELETE FROM automation_rules 
  WHERE deleted_at IS NOT NULL AND deleted_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_rules_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'logs_deleted', v_logs_deleted,
    'queue_deleted', v_queue_deleted,
    'rules_deleted', v_rules_deleted,
    'cleaned_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION seed_default_automation_rules(p_business_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO automation_rules (
    business_id, name, description, trigger_type, action_type,
    trigger_config, action_config, is_active
  )
  VALUES (
    p_business_id,
    'Invoice Payment Reminders',
    'Automatically send reminder emails for overdue invoices',
    'invoice_overdue',
    'send_reminder_email',
    '{}'::jsonb,
    '{"interval_days": 3, "max_reminders": 3}'::jsonb,
    false
  )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION on_business_created_seed_automations()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_automation_rules(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;