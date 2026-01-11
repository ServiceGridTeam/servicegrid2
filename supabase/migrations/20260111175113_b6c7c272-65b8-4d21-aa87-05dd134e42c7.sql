-- =============================================
-- Phase 2: Core Subscription Tables
-- =============================================

-- 1. SUBSCRIPTIONS TABLE (Main subscription entity)
-- =============================================
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  service_plan_id uuid REFERENCES public.service_plans(id) ON DELETE SET NULL,
  
  -- Identification
  subscription_number text NOT NULL,
  name text NOT NULL,
  description text,
  
  -- Status & State Machine
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'active', 'paused', 'cancelled', 'expired')),
  previous_status text,
  status_changed_at timestamptz,
  
  -- Schedule Configuration
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannually', 'annually', 'custom')),
  custom_interval_days integer CHECK (custom_interval_days > 0),
  billing_model text NOT NULL DEFAULT 'prepay' CHECK (billing_model IN ('prepay', 'per_visit', 'hybrid')),
  
  -- Dates
  start_date date NOT NULL,
  end_date date,
  next_service_date date,
  next_billing_date date,
  last_service_date date,
  last_billing_date date,
  
  -- Timezone & Scheduling Preferences
  timezone text NOT NULL DEFAULT 'America/New_York',
  preferred_day_of_week integer CHECK (preferred_day_of_week >= 0 AND preferred_day_of_week <= 6),
  preferred_time_window jsonb,
  
  -- Pricing
  price numeric(10,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  
  -- Pause State
  pause_start_date date,
  pause_end_date date,
  pause_reason text,
  
  -- Cancellation
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES public.profiles(id),
  cancellation_reason text,
  
  -- Payment Tracking
  payment_failure_count integer DEFAULT 0,
  last_payment_failure_at timestamptz,
  last_payment_failure_reason text,
  
  -- Counters
  total_jobs_generated integer DEFAULT 0,
  total_invoices_generated integer DEFAULT 0,
  total_revenue numeric(12,2) DEFAULT 0,
  
  -- Source Tracking
  source_quote_id uuid,
  converted_from_quote_at timestamptz,
  
  -- Portal
  allow_customer_pause boolean DEFAULT true,
  allow_customer_skip boolean DEFAULT true,
  max_customer_skips_per_year integer DEFAULT 2,
  customer_skips_this_year integer DEFAULT 0,
  
  -- Notes
  internal_notes text,
  customer_notes text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  -- Constraints
  CONSTRAINT valid_pause_dates CHECK (
    (pause_start_date IS NULL AND pause_end_date IS NULL) OR
    (pause_start_date IS NOT NULL AND (pause_end_date IS NULL OR pause_end_date >= pause_start_date))
  ),
  CONSTRAINT valid_custom_interval CHECK (
    (frequency != 'custom') OR (frequency = 'custom' AND custom_interval_days IS NOT NULL)
  )
);

-- Indexes for subscriptions
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions(customer_id);
CREATE INDEX idx_subscriptions_service_plan_id ON public.subscriptions(service_plan_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_next_service_date ON public.subscriptions(next_service_date) WHERE status = 'active';
CREATE INDEX idx_subscriptions_next_billing_date ON public.subscriptions(next_billing_date) WHERE status = 'active';
CREATE INDEX idx_subscriptions_number ON public.subscriptions(business_id, subscription_number);
CREATE INDEX idx_subscriptions_payment_failures ON public.subscriptions(business_id, payment_failure_count) WHERE payment_failure_count > 0;

-- Updated_at trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- State machine validation trigger
CREATE OR REPLACE FUNCTION public.validate_subscription_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions jsonb := '{
    "draft": ["active", "pending_payment", "cancelled"],
    "pending_payment": ["active", "cancelled"],
    "active": ["paused", "cancelled", "expired"],
    "paused": ["active", "cancelled"],
    "cancelled": [],
    "expired": []
  }'::jsonb;
  allowed_statuses jsonb;
BEGIN
  -- Skip validation if status hasn't changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get allowed transitions for current status
  allowed_statuses := valid_transitions->OLD.status;
  
  -- Check if new status is allowed
  IF NOT (allowed_statuses ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid subscription status transition from % to %', OLD.status, NEW.status;
  END IF;
  
  -- Set previous status and transition timestamp
  NEW.previous_status := OLD.status;
  NEW.status_changed_at := now();
  
  -- Set cancelled_at if transitioning to cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_subscription_status
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_subscription_status_transition();

-- RLS for subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subscriptions for their business"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscriptions.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
    )
  );

CREATE POLICY "Admins and owners can create subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscriptions.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
        AND business_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins and owners can update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscriptions.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
        AND business_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only owners can delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscriptions.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
        AND business_memberships.role = 'owner'
    )
  );

-- 2. SUBSCRIPTION ITEMS TABLE
-- =============================================
CREATE TABLE public.subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_items_subscription_id ON public.subscription_items(subscription_id);

CREATE TRIGGER update_subscription_items_updated_at
  BEFORE UPDATE ON public.subscription_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for subscription_items (inherited through subscription)
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subscription items for their business"
  ON public.subscription_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.business_memberships bm ON bm.business_id = s.business_id
      WHERE s.id = subscription_items.subscription_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "Admins and owners can manage subscription items"
  ON public.subscription_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.business_memberships bm ON bm.business_id = s.business_id
      WHERE s.id = subscription_items.subscription_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('owner', 'admin')
    )
  );

-- 3. SUBSCRIPTION SCHEDULES TABLE
-- =============================================
CREATE TABLE public.subscription_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Schedule Info
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'job_created', 'skipped', 'paused', 'completed')),
  
  -- Optimistic Locking
  version integer NOT NULL DEFAULT 1,
  
  -- Generated References
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_id uuid,
  
  -- Skip Handling
  skipped_at timestamptz,
  skipped_by uuid REFERENCES public.profiles(id),
  skip_reason text,
  is_customer_skip boolean DEFAULT false,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicate schedules
  CONSTRAINT unique_subscription_schedule UNIQUE (subscription_id, scheduled_date)
);

CREATE INDEX idx_subscription_schedules_subscription_id ON public.subscription_schedules(subscription_id);
CREATE INDEX idx_subscription_schedules_business_id ON public.subscription_schedules(business_id);
CREATE INDEX idx_subscription_schedules_date ON public.subscription_schedules(scheduled_date);
CREATE INDEX idx_subscription_schedules_status ON public.subscription_schedules(status);
CREATE INDEX idx_subscription_schedules_pending ON public.subscription_schedules(business_id, scheduled_date) 
  WHERE status = 'pending';
-- Unique index for idempotency using subscription_id and scheduled_date directly
CREATE UNIQUE INDEX idx_subscription_schedules_idempotency ON public.subscription_schedules(subscription_id, scheduled_date);

CREATE TRIGGER update_subscription_schedules_updated_at
  BEFORE UPDATE ON public.subscription_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Optimistic locking trigger
CREATE OR REPLACE FUNCTION public.subscription_schedule_optimistic_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment version on every update
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_schedule_version_increment
  BEFORE UPDATE ON public.subscription_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.subscription_schedule_optimistic_lock();

-- RLS for subscription_schedules
ALTER TABLE public.subscription_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedules for their business"
  ON public.subscription_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscription_schedules.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
    )
  );

CREATE POLICY "Admins and owners can manage schedules"
  ON public.subscription_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscription_schedules.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
        AND business_memberships.role IN ('owner', 'admin')
    )
  );

-- 4. SUBSCRIPTION EVENTS TABLE (Audit Log)
-- =============================================
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Event Info
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'activated', 'paused', 'resumed', 'skipped', 'cancelled',
    'price_changed', 'schedule_changed', 'job_generated', 'job_generation_failed',
    'invoice_generated', 'payment_received', 'payment_failed', 'payment_retry',
    'refund_issued', 'plan_changed'
  )),
  
  -- Actor Info
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'admin', 'customer')),
  actor_id uuid REFERENCES public.profiles(id),
  
  -- Event Data (sanitized - IDs only, no PII)
  metadata jsonb DEFAULT '{}',
  notes text,
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_subscription_id ON public.subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_business_id ON public.subscription_events(business_id);
CREATE INDEX idx_subscription_events_type ON public.subscription_events(event_type);
CREATE INDEX idx_subscription_events_created_at ON public.subscription_events(created_at DESC);

-- RLS for subscription_events
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their business"
  ON public.subscription_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscription_events.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
    )
  );

CREATE POLICY "System can insert events"
  ON public.subscription_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_memberships
      WHERE business_memberships.business_id = subscription_events.business_id
        AND business_memberships.user_id = auth.uid()
        AND business_memberships.status = 'active'
    )
  );