-- =====================================================
-- ServiceGrid Automations - Phase 1: Database Foundation
-- =====================================================

-- 1. Extend automation_rules table with L5 columns
-- ------------------------------------------------

-- Soft delete support
ALTER TABLE automation_rules
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);

-- Execution tracking
ALTER TABLE automation_rules
ADD COLUMN IF NOT EXISTS last_executed_at timestamptz,
ADD COLUMN IF NOT EXISTS execution_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error_message text;

-- Unique index for one active rule per business per trigger/action combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_rules_unique_active
ON automation_rules(business_id, trigger_type, action_type)
WHERE deleted_at IS NULL;

-- Index for active rules lookup (used by cron)
CREATE INDEX IF NOT EXISTS idx_automation_rules_active_lookup
ON automation_rules(business_id, trigger_type, action_type)
WHERE is_active = true AND deleted_at IS NULL;

-- 2. Add reminder_count to invoices table
-- ---------------------------------------

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

-- Backfill: set reminder_count to 1 for invoices that have been reminded
UPDATE invoices 
SET reminder_count = 1 
WHERE last_reminder_sent_at IS NOT NULL AND reminder_count = 0;

-- Index for reminder-eligible invoices (overdue, sent status)
CREATE INDEX IF NOT EXISTS idx_invoices_reminder_eligible
ON invoices(business_id, due_date, last_reminder_sent_at)
WHERE status = 'sent' AND balance_due > 0;

-- 3. Create automation_logs table
-- --------------------------------

CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE SET NULL,
  rule_name text NOT NULL,
  trigger_type text NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  result jsonb,
  idempotency_key text,
  cron_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_business_created 
ON automation_logs(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule 
ON automation_logs(rule_id) WHERE rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automation_logs_target 
ON automation_logs(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_automation_logs_status 
ON automation_logs(business_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_logs_idempotency 
ON automation_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Index for failed logs (no time-based predicate - filter at query time)
CREATE INDEX IF NOT EXISTS idx_automation_logs_failed
ON automation_logs(business_id, created_at DESC) 
WHERE status = 'failed';

-- RLS for automation_logs
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_logs_select_policy" ON automation_logs;
CREATE POLICY "automation_logs_select_policy" ON automation_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM business_memberships
    WHERE business_memberships.business_id = automation_logs.business_id
    AND business_memberships.user_id = auth.uid()
    AND business_memberships.status = 'active'
  )
);

-- 4. Create automation_failed_queue table
-- ----------------------------------------

CREATE TABLE IF NOT EXISTS automation_failed_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES automation_rules(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  max_attempts integer NOT NULL DEFAULT 3,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  error_message text,
  error_history jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'exhausted', 'resolved')),
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for pending retries
CREATE INDEX IF NOT EXISTS idx_automation_failed_pending 
ON automation_failed_queue(status, next_retry_at) 
WHERE status IN ('pending', 'retrying');

-- RLS for automation_failed_queue (admin/owner only)
ALTER TABLE automation_failed_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_failed_queue_select_policy" ON automation_failed_queue;
CREATE POLICY "automation_failed_queue_select_policy" ON automation_failed_queue
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM business_memberships
    WHERE business_memberships.business_id = automation_failed_queue.business_id
    AND business_memberships.user_id = auth.uid()
    AND business_memberships.status = 'active'
    AND business_memberships.role IN ('owner', 'admin')
  )
);

-- 5. Create cron_locks table
-- --------------------------

CREATE TABLE IF NOT EXISTS cron_locks (
  lock_name text PRIMARY KEY,
  locked_by text NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  heartbeat_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_locks_expires 
ON cron_locks(expires_at);

-- 6. Config validation trigger for automation_rules
-- -------------------------------------------------

CREATE OR REPLACE FUNCTION validate_automation_rule_config()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate invoice_overdue + send_reminder_email rules
  IF NEW.trigger_type = 'invoice_overdue' AND NEW.action_type = 'send_reminder_email' THEN
    -- Validate interval_days if present
    IF NEW.action_config ? 'interval_days' THEN
      IF NOT (NEW.action_config->>'interval_days')::int IN (3, 5, 7, 14) THEN
        RAISE EXCEPTION 'interval_days must be 3, 5, 7, or 14';
      END IF;
    END IF;
    
    -- Validate max_reminders if present
    IF NEW.action_config ? 'max_reminders' THEN
      IF (NEW.action_config->>'max_reminders')::int < 1 
         OR (NEW.action_config->>'max_reminders')::int > 10 THEN
        RAISE EXCEPTION 'max_reminders must be between 1 and 10';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_automation_rule_config ON automation_rules;
CREATE TRIGGER check_automation_rule_config
  BEFORE INSERT OR UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION validate_automation_rule_config();

-- 7. Cleanup function for automation data
-- ----------------------------------------

CREATE OR REPLACE FUNCTION cleanup_automation_data()
RETURNS jsonb AS $$
DECLARE
  v_logs_deleted integer := 0;
  v_queue_deleted integer := 0;
  v_rules_deleted integer := 0;
BEGIN
  -- Delete logs older than 90 days
  DELETE FROM automation_logs 
  WHERE created_at < now() - INTERVAL '90 days';
  GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
  
  -- Delete exhausted queue entries older than 30 days
  DELETE FROM automation_failed_queue 
  WHERE status = 'exhausted' AND created_at < now() - INTERVAL '30 days';
  
  -- Delete resolved queue entries older than 7 days
  DELETE FROM automation_failed_queue 
  WHERE status = 'resolved' AND resolved_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_queue_deleted = ROW_COUNT;
  
  -- Hard delete soft-deleted rules older than 90 days
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Seed default automation rules for a business
-- ------------------------------------------------

CREATE OR REPLACE FUNCTION seed_default_automation_rules(p_business_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default invoice reminder rule (disabled by default)
  INSERT INTO automation_rules (
    business_id,
    name,
    description,
    trigger_type,
    action_type,
    trigger_config,
    action_config,
    is_active
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger to seed default rules on business creation
-- -----------------------------------------------------

CREATE OR REPLACE FUNCTION on_business_created_seed_automations()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_default_automation_rules(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS seed_automation_rules_on_business_create ON businesses;
CREATE TRIGGER seed_automation_rules_on_business_create
  AFTER INSERT ON businesses
  FOR EACH ROW EXECUTE FUNCTION on_business_created_seed_automations();

-- 10. Backfill: Seed default rules for existing businesses
-- --------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM businesses LOOP
    PERFORM seed_default_automation_rules(r.id);
  END LOOP;
END $$;

-- 11. Enable realtime for automation_logs (for live updates)
-- ----------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE automation_logs;