-- Phase 3: Entity Extensions for Subscriptions
-- Extend existing tables with subscription-related columns

-- =============================================
-- 1. QUOTES TABLE EXTENSIONS
-- =============================================
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_frequency text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_billing_model text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_start_date date;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_preferred_day integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_preferred_time_start time;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_preferred_time_end time;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_timezone text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_to_subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Index for recurring quotes query
CREATE INDEX IF NOT EXISTS idx_quotes_recurring ON quotes(business_id, is_recurring) WHERE is_recurring = true;

-- =============================================
-- 2. JOBS TABLE EXTENSIONS
-- =============================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS subscription_schedule_id uuid REFERENCES subscription_schedules(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_subscription_job boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_subscription_origin boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurring_converted_at timestamptz;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS subscription_needs_invoice boolean DEFAULT false;

-- Indexes for subscription job queries
CREATE INDEX IF NOT EXISTS idx_jobs_subscription ON jobs(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_needs_invoice ON jobs(business_id, subscription_needs_invoice) WHERE subscription_needs_invoice = true;

-- =============================================
-- 3. INVOICES TABLE EXTENSIONS
-- =============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subscription_schedule_id uuid REFERENCES subscription_schedules(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_subscription_invoice boolean DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_start date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_end date;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refunded_amount decimal(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refund_reason text;

-- Index for subscription invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id) WHERE subscription_id IS NOT NULL;

-- =============================================
-- 4. CUSTOMERS TABLE EXTENSIONS
-- =============================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS active_subscription_count integer DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_subscription_value decimal(10,2) DEFAULT 0;

-- Index for customers with active subscriptions
CREATE INDEX IF NOT EXISTS idx_customers_subscriptions ON customers(business_id, active_subscription_count) WHERE active_subscription_count > 0;

-- =============================================
-- 5. BUSINESSES TABLE EXTENSIONS
-- =============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS default_timezone text DEFAULT 'America/New_York';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_job_lookahead_days integer DEFAULT 7;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_max_payment_retries integer DEFAULT 3;

-- =============================================
-- 6. CUSTOMER SUBSCRIPTION COUNTER TRIGGER
-- =============================================
-- Trigger to maintain denormalized customer subscription counters

CREATE OR REPLACE FUNCTION update_customer_subscription_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE customers SET 
        active_subscription_count = active_subscription_count + 1,
        total_subscription_value = total_subscription_value + COALESCE(NEW.price, 0)
      WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Status changed TO active
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE customers SET 
        active_subscription_count = active_subscription_count + 1,
        total_subscription_value = total_subscription_value + COALESCE(NEW.price, 0)
      WHERE id = NEW.customer_id;
    -- Status changed FROM active
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE customers SET 
        active_subscription_count = GREATEST(0, active_subscription_count - 1),
        total_subscription_value = GREATEST(0, total_subscription_value - COALESCE(OLD.price, 0))
      WHERE id = NEW.customer_id;
    -- Price changed while active
    ELSIF OLD.status = 'active' AND NEW.status = 'active' AND OLD.price IS DISTINCT FROM NEW.price THEN
      UPDATE customers SET 
        total_subscription_value = GREATEST(0, total_subscription_value - COALESCE(OLD.price, 0) + COALESCE(NEW.price, 0))
      WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE customers SET 
        active_subscription_count = GREATEST(0, active_subscription_count - 1),
        total_subscription_value = GREATEST(0, total_subscription_value - COALESCE(OLD.price, 0))
      WHERE id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_customer_subscription_counters ON subscriptions;
CREATE TRIGGER trg_update_customer_subscription_counters
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_subscription_counters();