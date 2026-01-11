-- =====================================================
-- Phase 4: Subscription Stored Procedures
-- =====================================================

-- =====================================================
-- 1. CREATE SUBSCRIPTION (Transactional)
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_subscription(
  p_business_id uuid,
  p_customer_id uuid,
  p_service_plan_id uuid DEFAULT NULL,
  p_frequency text DEFAULT 'monthly',
  p_billing_model text DEFAULT 'prepay',
  p_price_per_visit numeric DEFAULT 0,
  p_start_date date DEFAULT CURRENT_DATE,
  p_preferred_day integer DEFAULT NULL,
  p_preferred_time_start time DEFAULT NULL,
  p_preferred_time_end time DEFAULT NULL,
  p_timezone text DEFAULT 'America/New_York',
  p_notes text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL,
  p_line_items jsonb DEFAULT '[]'::jsonb,
  p_activate_immediately boolean DEFAULT true,
  p_created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_subscription_number text;
  v_item jsonb;
  v_schedules_generated integer;
BEGIN
  -- Generate subscription number with advisory lock
  v_subscription_number := generate_subscription_number(p_business_id);
  
  -- Create subscription record
  INSERT INTO subscriptions (
    id,
    business_id,
    customer_id,
    service_plan_id,
    subscription_number,
    status,
    frequency,
    billing_model,
    price_per_visit,
    start_date,
    preferred_day,
    preferred_time_start,
    preferred_time_end,
    timezone,
    notes,
    internal_notes,
    next_service_date,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    p_business_id,
    p_customer_id,
    p_service_plan_id,
    v_subscription_number,
    CASE WHEN p_activate_immediately THEN 'active' ELSE 'pending' END,
    p_frequency,
    p_billing_model,
    p_price_per_visit,
    p_start_date,
    p_preferred_day,
    p_preferred_time_start,
    p_preferred_time_end,
    p_timezone,
    p_notes,
    p_internal_notes,
    p_start_date,
    now(),
    now()
  )
  RETURNING id INTO v_subscription_id;
  
  -- Create line items from JSON array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO subscription_items (
      subscription_id,
      description,
      quantity,
      unit_price,
      total,
      sort_order
    ) VALUES (
      v_subscription_id,
      v_item->>'description',
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'total')::numeric, 
        COALESCE((v_item->>'quantity')::numeric, 1) * COALESCE((v_item->>'unit_price')::numeric, 0)),
      COALESCE((v_item->>'sort_order')::integer, 0)
    );
  END LOOP;
  
  -- Generate initial 3-month schedule if activating
  IF p_activate_immediately THEN
    v_schedules_generated := generate_subscription_schedules(v_subscription_id, 3);
  END IF;
  
  -- Log creation event
  INSERT INTO subscription_events (
    subscription_id,
    event_type,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    v_subscription_id,
    'created',
    p_created_by,
    CASE WHEN p_created_by IS NOT NULL THEN 'staff' ELSE 'system' END,
    jsonb_build_object(
      'frequency', p_frequency,
      'billing_model', p_billing_model,
      'price_per_visit', p_price_per_visit,
      'schedules_generated', v_schedules_generated
    )
  );
  
  RETURN v_subscription_id;
END;
$$;

-- =====================================================
-- 2. GENERATE SUBSCRIPTION SCHEDULES (Rolling Window)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_subscription_schedules(
  p_subscription_id uuid,
  p_months_ahead integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_last_scheduled date;
  v_next_date date;
  v_end_date date;
  v_interval interval;
  v_count integer := 0;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;
  
  -- Determine interval based on frequency
  v_interval := CASE v_subscription.frequency
    WHEN 'weekly' THEN interval '1 week'
    WHEN 'biweekly' THEN interval '2 weeks'
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'bimonthly' THEN interval '2 months'
    WHEN 'quarterly' THEN interval '3 months'
    WHEN 'semiannual' THEN interval '6 months'
    WHEN 'annual' THEN interval '1 year'
    ELSE interval '1 month'
  END;
  
  -- Find last scheduled date or use start date
  SELECT COALESCE(MAX(scheduled_date), v_subscription.start_date - v_interval::interval)
  INTO v_last_scheduled
  FROM subscription_schedules
  WHERE subscription_id = p_subscription_id;
  
  -- Calculate end date for generation
  v_end_date := CURRENT_DATE + (p_months_ahead || ' months')::interval;
  
  -- Generate schedules
  v_next_date := v_last_scheduled + v_interval;
  
  WHILE v_next_date <= v_end_date LOOP
    -- Skip dates before start_date
    IF v_next_date >= v_subscription.start_date THEN
      -- Use ON CONFLICT for idempotency
      INSERT INTO subscription_schedules (
        subscription_id,
        scheduled_date,
        preferred_time_start,
        preferred_time_end,
        status,
        version
      ) VALUES (
        p_subscription_id,
        v_next_date,
        v_subscription.preferred_time_start,
        v_subscription.preferred_time_end,
        'pending',
        1
      )
      ON CONFLICT (subscription_id, scheduled_date) DO NOTHING;
      
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    END IF;
    
    v_next_date := v_next_date + v_interval;
  END LOOP;
  
  -- Update next_service_date on subscription
  UPDATE subscriptions
  SET next_service_date = (
    SELECT MIN(scheduled_date)
    FROM subscription_schedules
    WHERE subscription_id = p_subscription_id
      AND status = 'pending'
      AND scheduled_date >= CURRENT_DATE
  ),
  updated_at = now()
  WHERE id = p_subscription_id;
  
  RETURN v_count;
END;
$$;

-- =====================================================
-- 3. SKIP SCHEDULED VISIT (Optimistic Locking)
-- =====================================================
CREATE OR REPLACE FUNCTION public.skip_scheduled_visit(
  p_schedule_id uuid,
  p_reason text DEFAULT NULL,
  p_skipped_by uuid DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_subscription_id uuid;
BEGIN
  -- Lock and fetch schedule
  SELECT * INTO v_schedule
  FROM subscription_schedules
  WHERE id = p_schedule_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;
  
  -- Validate status
  IF v_schedule.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot skip schedule with status: %', v_schedule.status;
  END IF;
  
  -- Validate date is in future
  IF v_schedule.scheduled_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot skip past schedule';
  END IF;
  
  -- Optimistic locking check
  IF p_expected_version IS NOT NULL AND v_schedule.version != p_expected_version THEN
    RAISE EXCEPTION 'Concurrent modification detected';
  END IF;
  
  v_subscription_id := v_schedule.subscription_id;
  
  -- Update schedule
  UPDATE subscription_schedules
  SET 
    status = 'skipped',
    skipped_at = now(),
    skip_reason = p_reason,
    version = version + 1,
    updated_at = now()
  WHERE id = p_schedule_id;
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    schedule_id,
    event_type,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    v_subscription_id,
    p_schedule_id,
    'skipped',
    p_skipped_by,
    CASE WHEN p_skipped_by IS NOT NULL THEN 'staff' ELSE 'system' END,
    jsonb_build_object(
      'scheduled_date', v_schedule.scheduled_date,
      'reason', p_reason
    )
  );
  
  -- Update next_service_date
  UPDATE subscriptions
  SET next_service_date = (
    SELECT MIN(scheduled_date)
    FROM subscription_schedules
    WHERE subscription_id = v_subscription_id
      AND status = 'pending'
      AND scheduled_date >= CURRENT_DATE
  ),
  updated_at = now()
  WHERE id = v_subscription_id;
  
  RETURN true;
END;
$$;

-- =====================================================
-- 4. PAUSE SUBSCRIPTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.pause_subscription(
  p_subscription_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_paused_by uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Lock and fetch subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;
  
  -- Validate status
  IF v_subscription.status != 'active' THEN
    RAISE EXCEPTION 'Cannot pause subscription with status: %', v_subscription.status;
  END IF;
  
  -- Update subscription
  UPDATE subscriptions
  SET 
    status = 'paused',
    pause_start_date = p_start_date,
    pause_end_date = p_end_date,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Update pending schedules within pause period
  UPDATE subscription_schedules
  SET 
    status = 'paused',
    updated_at = now()
  WHERE subscription_id = p_subscription_id
    AND status = 'pending'
    AND scheduled_date >= p_start_date
    AND (p_end_date IS NULL OR scheduled_date <= p_end_date);
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    event_type,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    p_subscription_id,
    'paused',
    p_paused_by,
    CASE WHEN p_paused_by IS NOT NULL THEN 'staff' ELSE 'system' END,
    jsonb_build_object(
      'pause_start_date', p_start_date,
      'pause_end_date', p_end_date,
      'reason', p_reason
    )
  );
  
  RETURN true;
END;
$$;

-- =====================================================
-- 5. RESUME SUBSCRIPTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.resume_subscription(
  p_subscription_id uuid,
  p_resumed_by uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_schedules_generated integer;
BEGIN
  -- Lock and fetch subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;
  
  -- Validate status
  IF v_subscription.status != 'paused' THEN
    RAISE EXCEPTION 'Cannot resume subscription with status: %', v_subscription.status;
  END IF;
  
  -- Update subscription
  UPDATE subscriptions
  SET 
    status = 'active',
    pause_start_date = NULL,
    pause_end_date = NULL,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Reactivate paused schedules that are still in the future
  UPDATE subscription_schedules
  SET 
    status = 'pending',
    updated_at = now()
  WHERE subscription_id = p_subscription_id
    AND status = 'paused'
    AND scheduled_date >= CURRENT_DATE;
  
  -- Generate any missing schedules
  v_schedules_generated := generate_subscription_schedules(p_subscription_id, 3);
  
  -- Update next_service_date
  UPDATE subscriptions
  SET next_service_date = (
    SELECT MIN(scheduled_date)
    FROM subscription_schedules
    WHERE subscription_id = p_subscription_id
      AND status = 'pending'
      AND scheduled_date >= CURRENT_DATE
  )
  WHERE id = p_subscription_id;
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    event_type,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    p_subscription_id,
    'resumed',
    p_resumed_by,
    CASE WHEN p_resumed_by IS NOT NULL THEN 'staff' ELSE 'system' END,
    jsonb_build_object(
      'schedules_reactivated', true,
      'schedules_generated', v_schedules_generated
    )
  );
  
  RETURN true;
END;
$$;

-- =====================================================
-- 6. CANCEL SUBSCRIPTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_subscription_id uuid,
  p_reason text DEFAULT NULL,
  p_cancelled_by uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  -- Lock and fetch subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;
  
  -- Validate not already terminal
  IF v_subscription.status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Cannot cancel subscription with status: %', v_subscription.status;
  END IF;
  
  -- Update subscription
  UPDATE subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    end_date = CURRENT_DATE,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Update pending schedules to skipped
  UPDATE subscription_schedules
  SET 
    status = 'skipped',
    skip_reason = 'Subscription cancelled',
    skipped_at = now(),
    updated_at = now()
  WHERE subscription_id = p_subscription_id
    AND status IN ('pending', 'paused');
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    event_type,
    actor_id,
    actor_type,
    metadata
  ) VALUES (
    p_subscription_id,
    'cancelled',
    p_cancelled_by,
    CASE WHEN p_cancelled_by IS NOT NULL THEN 'staff' ELSE 'system' END,
    jsonb_build_object(
      'reason', p_reason,
      'previous_status', v_subscription.status
    )
  );
  
  RETURN true;
END;
$$;

-- =====================================================
-- 7. GENERATE SUBSCRIPTION JOB (Fixed syntax)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_subscription_job(
  p_schedule_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_subscription RECORD;
  v_customer RECORD;
  v_job_id uuid;
  v_job_number text;
  v_max_num integer;
BEGIN
  -- Lock schedule with SKIP LOCKED for concurrent processing
  SELECT * INTO v_schedule
  FROM subscription_schedules
  WHERE id = p_schedule_id
    AND status = 'pending'
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    -- Already processed or locked by another process
    RETURN NULL;
  END IF;
  
  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = v_schedule.subscription_id;
  
  IF v_subscription.status != 'active' THEN
    RAISE EXCEPTION 'Cannot generate job for non-active subscription';
  END IF;
  
  -- Get customer for address
  SELECT * INTO v_customer
  FROM customers
  WHERE id = v_subscription.customer_id;
  
  -- Generate job number (separate query to avoid double INTO)
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(job_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  INTO v_max_num
  FROM jobs
  WHERE business_id = v_subscription.business_id;
  
  v_job_number := 'JOB-' || LPAD(v_max_num::text, 6, '0');
  
  -- Create job
  INSERT INTO jobs (
    business_id,
    customer_id,
    job_number,
    title,
    description,
    status,
    scheduled_start,
    scheduled_end,
    address_line1,
    city,
    state,
    zip,
    subscription_id,
    subscription_schedule_id,
    is_subscription_job,
    subscription_needs_invoice
  ) VALUES (
    v_subscription.business_id,
    v_subscription.customer_id,
    v_job_number,
    'Subscription Service - ' || v_subscription.subscription_number,
    v_subscription.notes,
    'scheduled',
    v_schedule.scheduled_date + COALESCE(v_schedule.preferred_time_start, '09:00'::time),
    v_schedule.scheduled_date + COALESCE(v_schedule.preferred_time_end, '17:00'::time),
    v_customer.address_line1,
    v_customer.city,
    v_customer.state,
    v_customer.zip,
    v_subscription.id,
    v_schedule.id,
    true,
    CASE WHEN v_subscription.billing_model = 'per_visit' THEN true ELSE false END
  )
  RETURNING id INTO v_job_id;
  
  -- Update schedule
  UPDATE subscription_schedules
  SET 
    status = 'job_created',
    job_id = v_job_id,
    version = version + 1,
    updated_at = now()
  WHERE id = p_schedule_id;
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    schedule_id,
    job_id,
    event_type,
    actor_type,
    metadata
  ) VALUES (
    v_subscription.id,
    p_schedule_id,
    v_job_id,
    'job_generated',
    'system',
    jsonb_build_object(
      'scheduled_date', v_schedule.scheduled_date,
      'job_number', v_job_number
    )
  );
  
  RETURN v_job_id;
END;
$$;

-- =====================================================
-- 8. GENERATE SUBSCRIPTION INVOICE (Fixed syntax)
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_subscription_invoice(
  p_subscription_id uuid,
  p_billing_period_start date DEFAULT NULL,
  p_billing_period_end date DEFAULT NULL,
  p_schedule_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_invoice_id uuid;
  v_invoice_number text;
  v_total numeric := 0;
  v_item RECORD;
  v_max_num integer;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found: %', p_subscription_id;
  END IF;
  
  -- Calculate total from line items
  SELECT COALESCE(SUM(total), v_subscription.price_per_visit)
  INTO v_total
  FROM subscription_items
  WHERE subscription_id = p_subscription_id;
  
  -- Generate invoice number (separate query to avoid double INTO)
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  INTO v_max_num
  FROM invoices
  WHERE business_id = v_subscription.business_id;
  
  v_invoice_number := 'INV-' || LPAD(v_max_num::text, 6, '0');
  
  -- Create invoice
  INSERT INTO invoices (
    business_id,
    customer_id,
    invoice_number,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    balance_due,
    due_date,
    subscription_id,
    subscription_schedule_id,
    is_subscription_invoice,
    billing_period_start,
    billing_period_end
  ) VALUES (
    v_subscription.business_id,
    v_subscription.customer_id,
    v_invoice_number,
    'draft',
    v_total,
    0,
    0,
    v_total,
    v_total,
    CURRENT_DATE + interval '30 days',
    p_subscription_id,
    p_schedule_id,
    true,
    p_billing_period_start,
    p_billing_period_end
  )
  RETURNING id INTO v_invoice_id;
  
  -- Copy subscription items to invoice line items
  FOR v_item IN 
    SELECT * FROM subscription_items WHERE subscription_id = p_subscription_id ORDER BY sort_order
  LOOP
    INSERT INTO invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      total,
      sort_order
    ) VALUES (
      v_invoice_id,
      v_item.description,
      v_item.quantity,
      v_item.unit_price,
      v_item.total,
      v_item.sort_order
    );
  END LOOP;
  
  -- Update subscription next_billing_date
  UPDATE subscriptions
  SET 
    next_billing_date = CASE v_subscription.billing_model
      WHEN 'prepay' THEN p_billing_period_end + interval '1 day'
      ELSE next_service_date
    END,
    updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log event
  INSERT INTO subscription_events (
    subscription_id,
    schedule_id,
    invoice_id,
    event_type,
    actor_type,
    metadata
  ) VALUES (
    p_subscription_id,
    p_schedule_id,
    v_invoice_id,
    'invoice_generated',
    'system',
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'total', v_total,
      'billing_period_start', p_billing_period_start,
      'billing_period_end', p_billing_period_end
    )
  );
  
  RETURN v_invoice_id;
END;
$$;

-- =====================================================
-- 9. GET PENDING SCHEDULES FOR PROCESSING
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_pending_schedules_for_processing(
  p_business_id uuid,
  p_lookahead_days integer DEFAULT 7,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  schedule_id uuid,
  subscription_id uuid,
  subscription_number text,
  customer_id uuid,
  customer_name text,
  scheduled_date date,
  preferred_time_start time,
  preferred_time_end time,
  frequency text,
  billing_model text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id as schedule_id,
    s.id as subscription_id,
    s.subscription_number,
    s.customer_id,
    c.first_name || ' ' || c.last_name as customer_name,
    ss.scheduled_date,
    ss.preferred_time_start,
    ss.preferred_time_end,
    s.frequency,
    s.billing_model
  FROM subscription_schedules ss
  JOIN subscriptions s ON s.id = ss.subscription_id
  JOIN customers c ON c.id = s.customer_id
  WHERE s.business_id = p_business_id
    AND s.status = 'active'
    AND ss.status = 'pending'
    AND ss.scheduled_date <= CURRENT_DATE + (p_lookahead_days || ' days')::interval
    AND ss.scheduled_date >= CURRENT_DATE
  ORDER BY ss.scheduled_date ASC, ss.preferred_time_start ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- 10. GENERATE SCHEDULES FOR ACTIVE SUBSCRIPTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_schedules_for_active_subscriptions(
  p_business_id uuid DEFAULT NULL,
  p_months_ahead integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_total_generated integer := 0;
  v_generated integer;
BEGIN
  FOR v_subscription IN 
    SELECT id FROM subscriptions 
    WHERE status = 'active'
      AND (p_business_id IS NULL OR business_id = p_business_id)
  LOOP
    v_generated := generate_subscription_schedules(v_subscription.id, p_months_ahead);
    v_total_generated := v_total_generated + v_generated;
  END LOOP;
  
  RETURN v_total_generated;
END;
$$;

-- =====================================================
-- 11. PORTAL: GET SUBSCRIPTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION public.portal_get_subscriptions(
  p_customer_id uuid,
  p_business_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(sub_data ORDER BY sub_data->>'next_service_date')
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'subscription_number', s.subscription_number,
      'status', s.status,
      'frequency', s.frequency,
      'price_per_visit', s.price_per_visit,
      'start_date', s.start_date,
      'next_service_date', s.next_service_date,
      'preferred_day', s.preferred_day,
      'preferred_time_start', s.preferred_time_start,
      'preferred_time_end', s.preferred_time_end,
      'notes', s.notes,
      'service_plan', CASE 
        WHEN sp.id IS NOT NULL THEN jsonb_build_object(
          'id', sp.id,
          'name', sp.name,
          'description', sp.description
        )
        ELSE NULL
      END,
      'upcoming_schedules', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', ss.id,
          'scheduled_date', ss.scheduled_date,
          'preferred_time_start', ss.preferred_time_start,
          'preferred_time_end', ss.preferred_time_end,
          'status', ss.status
        ) ORDER BY ss.scheduled_date)
        FROM subscription_schedules ss
        WHERE ss.subscription_id = s.id
          AND ss.status = 'pending'
          AND ss.scheduled_date >= CURRENT_DATE
        LIMIT 3
      )
    ) as sub_data
    FROM subscriptions s
    LEFT JOIN service_plans sp ON sp.id = s.service_plan_id
    WHERE s.customer_id = p_customer_id
      AND s.business_id = p_business_id
      AND s.status NOT IN ('cancelled')
  ) sub_query;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- =====================================================
-- 12. PORTAL: SKIP VISIT (Customer Self-Service)
-- =====================================================
CREATE OR REPLACE FUNCTION public.portal_skip_visit(
  p_schedule_id uuid,
  p_customer_id uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_subscription RECORD;
BEGIN
  -- Get schedule
  SELECT * INTO v_schedule
  FROM subscription_schedules
  WHERE id = p_schedule_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule not found';
  END IF;
  
  -- Get subscription and validate ownership
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = v_schedule.subscription_id;
  
  IF v_subscription.customer_id != p_customer_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Validate skip is >24 hours in advance
  IF v_schedule.scheduled_date <= CURRENT_DATE + interval '1 day' THEN
    RAISE EXCEPTION 'Must skip at least 24 hours in advance';
  END IF;
  
  -- Call internal skip function with customer actor
  RETURN skip_scheduled_visit(
    p_schedule_id,
    COALESCE(p_reason, 'Skipped by customer'),
    NULL  -- No user_id for portal actions
  );
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.create_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_subscription_schedules TO authenticated;
GRANT EXECUTE ON FUNCTION public.skip_scheduled_visit TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_subscription_job TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_subscription_invoice TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_schedules_for_processing TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_schedules_for_active_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_subscriptions TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_skip_visit TO authenticated;