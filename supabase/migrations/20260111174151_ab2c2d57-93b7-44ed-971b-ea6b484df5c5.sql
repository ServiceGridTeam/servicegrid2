-- ============================================================================
-- Migration: Service Subscriptions Phase 1 - Infrastructure Tables
-- ============================================================================

-- 1. Subscription Metrics Table (for observability)
CREATE TABLE IF NOT EXISTS public.subscription_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  dimensions jsonb DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for metrics
CREATE INDEX IF NOT EXISTS idx_metrics_name_time ON public.subscription_metrics (metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON public.subscription_metrics (recorded_at);

-- RLS for metrics (admin read-only, system insert via service role)
ALTER TABLE public.subscription_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view subscription metrics"
  ON public.subscription_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
      AND bm.status = 'active'
    )
  );

-- 2. Subscription Number Sequences Table
CREATE TABLE IF NOT EXISTS public.subscription_number_sequences (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'SUB',
  next_number integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for sequences (internal use only)
ALTER TABLE public.subscription_number_sequences ENABLE ROW LEVEL SECURITY;

-- 3. Generate Subscription Number Function (with advisory lock)
CREATE OR REPLACE FUNCTION public.generate_subscription_number(p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next_number integer;
  v_subscription_number text;
  v_lock_id bigint;
BEGIN
  -- Create a unique lock ID from business_id
  v_lock_id := ('x' || substr(md5(p_business_id::text), 1, 15))::bit(60)::bigint;
  
  -- Acquire advisory lock
  PERFORM pg_advisory_xact_lock(v_lock_id);
  
  -- Get or create sequence for business
  INSERT INTO subscription_number_sequences (business_id, prefix, next_number)
  VALUES (p_business_id, 'SUB', 1)
  ON CONFLICT (business_id) DO NOTHING;
  
  -- Get current values and increment
  UPDATE subscription_number_sequences
  SET next_number = next_number + 1,
      updated_at = now()
  WHERE business_id = p_business_id
  RETURNING prefix, next_number - 1 INTO v_prefix, v_next_number;
  
  -- Generate formatted number
  v_subscription_number := v_prefix || '-' || lpad(v_next_number::text, 5, '0');
  
  RETURN v_subscription_number;
END;
$$;

-- 4. Service Plans Table
CREATE TABLE IF NOT EXISTS public.service_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Plan Identity
  name text NOT NULL,
  description text,
  internal_notes text,
  code text,
  
  -- Pricing
  base_price decimal(10,2) NOT NULL,
  billing_model text NOT NULL,
  default_frequency text NOT NULL,
  
  -- Service Details
  estimated_duration_minutes integer,
  default_line_items jsonb DEFAULT '[]',
  
  -- Tax
  is_taxable boolean DEFAULT true,
  tax_rate_override decimal(5,4),
  
  -- Availability
  is_active boolean DEFAULT true,
  available_in_portal boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  
  -- Soft Delete
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id),
  
  -- Audit
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT service_plans_billing_model_check CHECK (billing_model IN ('prepay', 'per_visit', 'hybrid')),
  CONSTRAINT service_plans_frequency_check CHECK (default_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  CONSTRAINT service_plans_price_check CHECK (base_price >= 0),
  CONSTRAINT service_plans_name_length_check CHECK (char_length(name) <= 200),
  CONSTRAINT service_plans_code_length_check CHECK (code IS NULL OR char_length(code) <= 50)
);

-- Unique constraint for code per business (partial - only non-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_plans_unique_code 
  ON public.service_plans (business_id, code) 
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- Indexes for service plans
CREATE INDEX IF NOT EXISTS idx_service_plan_business ON public.service_plans (business_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_plan_active ON public.service_plans (business_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_service_plan_portal ON public.service_plans (business_id, available_in_portal) 
  WHERE is_active = true AND available_in_portal = true AND deleted_at IS NULL;

-- Add updated_at trigger for service_plans
CREATE TRIGGER update_service_plans_updated_at
  BEFORE UPDATE ON public.service_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for service_plans
ALTER TABLE public.service_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: All business members can view plans
CREATE POLICY "Business members can view service plans"
  ON public.service_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.business_id = service_plans.business_id
      AND bm.status = 'active'
    )
  );

-- INSERT: Only admin/owner can create plans
CREATE POLICY "Admins can create service plans"
  ON public.service_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.business_id = service_plans.business_id
      AND bm.role IN ('owner', 'admin')
      AND bm.status = 'active'
    )
  );

-- UPDATE: Only admin/owner can update plans
CREATE POLICY "Admins can update service plans"
  ON public.service_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.business_id = service_plans.business_id
      AND bm.role IN ('owner', 'admin')
      AND bm.status = 'active'
    )
  );

-- DELETE: Only owner can delete plans (soft delete preferred)
CREATE POLICY "Owners can delete service plans"
  ON public.service_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.business_id = service_plans.business_id
      AND bm.role = 'owner'
      AND bm.status = 'active'
    )
  );

-- Enable realtime for service_plans
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_plans;