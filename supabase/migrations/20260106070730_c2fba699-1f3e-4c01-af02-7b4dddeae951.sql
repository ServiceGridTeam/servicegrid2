-- =====================================================
-- PHASE 1: TIMESHEETS & LABOR MANAGEMENT - DATABASE FOUNDATION
-- =====================================================

-- 1. Create pay_periods table
CREATE TABLE public.pay_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'processing', 'paid')),
  total_hours NUMERIC(10,2) DEFAULT 0,
  total_regular_hours NUMERIC(10,2) DEFAULT 0,
  total_overtime_hours NUMERIC(10,2) DEFAULT 0,
  total_labor_cost NUMERIC(12,2) DEFAULT 0,
  locked_at TIMESTAMP WITH TIME ZONE,
  locked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 2. Create timesheet_approvals table
CREATE TABLE public.timesheet_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pay_period_id UUID NOT NULL REFERENCES public.pay_periods(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'revised')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_notes TEXT,
  total_hours NUMERIC(10,2) DEFAULT 0,
  regular_hours NUMERIC(10,2) DEFAULT 0,
  overtime_hours NUMERIC(10,2) DEFAULT 0,
  double_time_hours NUMERIC(10,2) DEFAULT 0,
  total_labor_cost NUMERIC(12,2) DEFAULT 0,
  has_anomalies BOOLEAN DEFAULT false,
  anomaly_details JSONB DEFAULT '[]'::jsonb,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, pay_period_id)
);

-- 3. Create employee_pay_rates table
CREATE TABLE public.employee_pay_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(10,2) NOT NULL,
  overtime_rate NUMERIC(10,2),
  double_time_rate NUMERIC(10,2),
  bill_rate NUMERIC(10,2),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- 4. Create time_entry_edits table (audit log)
CREATE TABLE public.time_entry_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  edit_reason TEXT NOT NULL,
  previous_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create break_rules table
CREATE TABLE public.break_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_hours NUMERIC(4,2) NOT NULL,
  deduction_minutes INTEGER NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  is_automatic BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Extend time_entries table with new columns
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS pay_period_id UUID REFERENCES public.pay_periods(id),
ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_entry_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS break_deduction_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES public.profiles(id);

-- 7. Extend profiles table with new columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS requires_timesheet_approval BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_approve_timesheets BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS overtime_exempt BOOLEAN DEFAULT false;

-- 8. Extend jobs table with labor tracking columns
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS total_labor_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_labor_cost NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_billable_amount NUMERIC(10,2) DEFAULT 0;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pay_periods_business_id ON public.pay_periods(business_id);
CREATE INDEX IF NOT EXISTS idx_pay_periods_dates ON public.pay_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_pay_periods_status ON public.pay_periods(status);

CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_business_id ON public.timesheet_approvals(business_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_user_id ON public.timesheet_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_pay_period_id ON public.timesheet_approvals(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_approvals_status ON public.timesheet_approvals(status);

CREATE INDEX IF NOT EXISTS idx_employee_pay_rates_user_id ON public.employee_pay_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_pay_rates_effective ON public.employee_pay_rates(effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_time_entry_edits_time_entry_id ON public.time_entry_edits(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_entry_edits_edited_by ON public.time_entry_edits(edited_by);

CREATE INDEX IF NOT EXISTS idx_time_entries_pay_period_id ON public.time_entries(pay_period_id);

-- 10. Enable RLS on new tables
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_pay_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_rules ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for pay_periods
CREATE POLICY "Users can view pay periods in their business"
ON public.pay_periods FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Admins can manage pay periods"
ON public.pay_periods FOR ALL
USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 12. RLS Policies for timesheet_approvals
CREATE POLICY "Users can view their own timesheet approvals"
ON public.timesheet_approvals FOR SELECT
USING (user_id = auth.uid() OR user_belongs_to_business(business_id));

CREATE POLICY "Users can insert their own timesheet approvals"
ON public.timesheet_approvals FOR INSERT
WITH CHECK (user_id = auth.uid() AND user_belongs_to_business(business_id));

CREATE POLICY "Users can update their own draft timesheets"
ON public.timesheet_approvals FOR UPDATE
USING (
  (user_id = auth.uid() AND status IN ('draft', 'rejected')) OR 
  (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')))
);

-- 13. RLS Policies for employee_pay_rates
CREATE POLICY "Users can view their own pay rates"
ON public.employee_pay_rates FOR SELECT
USING (user_id = auth.uid() OR (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))));

CREATE POLICY "Admins can manage pay rates"
ON public.employee_pay_rates FOR ALL
USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 14. RLS Policies for time_entry_edits
CREATE POLICY "Users can view edit history in their business"
ON public.time_entry_edits FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can create edit records"
ON public.time_entry_edits FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

-- 15. RLS Policies for break_rules
CREATE POLICY "Users can view break rules in their business"
ON public.break_rules FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Admins can manage break rules"
ON public.break_rules FOR ALL
USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 16. Create function to calculate time entry labor cost
CREATE OR REPLACE FUNCTION public.calculate_time_entry_labor_cost(p_entry_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry RECORD;
  v_rate RECORD;
  v_duration_hours NUMERIC;
  v_labor_cost NUMERIC;
BEGIN
  -- Get the time entry
  SELECT * INTO v_entry FROM time_entries WHERE id = p_entry_id;
  IF v_entry IS NULL THEN
    RETURN 0;
  END IF;

  -- Get effective pay rate for the user on that date
  SELECT * INTO v_rate 
  FROM employee_pay_rates 
  WHERE user_id = v_entry.user_id
    AND effective_from <= COALESCE(v_entry.clock_in_time::date, CURRENT_DATE)
    AND (effective_to IS NULL OR effective_to >= COALESCE(v_entry.clock_in_time::date, CURRENT_DATE))
    AND is_current = true
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Calculate duration in hours
  v_duration_hours := COALESCE(v_entry.duration_minutes, 0) / 60.0;
  
  -- Calculate labor cost using hourly rate (or profile default)
  IF v_rate IS NOT NULL THEN
    v_labor_cost := v_duration_hours * v_rate.hourly_rate;
  ELSE
    -- Fall back to profile default rate
    SELECT default_hourly_rate INTO v_labor_cost
    FROM profiles WHERE id = v_entry.user_id;
    v_labor_cost := v_duration_hours * COALESCE(v_labor_cost, 0);
  END IF;

  -- Update the time entry with calculated cost
  UPDATE time_entries 
  SET labor_cost = v_labor_cost
  WHERE id = p_entry_id;

  RETURN v_labor_cost;
END;
$$;

-- 17. Create trigger function to update job labor totals
CREATE OR REPLACE FUNCTION public.update_job_labor_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job_id UUID;
  v_totals RECORD;
BEGIN
  -- Get the job_id from either NEW or OLD record
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  IF v_job_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate totals for the job
  SELECT 
    COALESCE(SUM(duration_minutes), 0) as total_minutes,
    COALESCE(SUM(labor_cost), 0) as total_cost,
    COALESCE(SUM(CASE WHEN is_billable THEN bill_amount ELSE 0 END), 0) as total_billable
  INTO v_totals
  FROM time_entries
  WHERE job_id = v_job_id;

  -- Update the job
  UPDATE jobs
  SET 
    total_labor_minutes = v_totals.total_minutes,
    total_labor_cost = v_totals.total_cost,
    total_billable_amount = v_totals.total_billable,
    updated_at = now()
  WHERE id = v_job_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 18. Create trigger on time_entries for job labor totals
DROP TRIGGER IF EXISTS time_entry_labor_totals ON public.time_entries;
CREATE TRIGGER time_entry_labor_totals
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_job_labor_totals();

-- 19. Add updated_at triggers for new tables
CREATE TRIGGER update_pay_periods_updated_at
BEFORE UPDATE ON public.pay_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheet_approvals_updated_at
BEFORE UPDATE ON public.timesheet_approvals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_pay_rates_updated_at
BEFORE UPDATE ON public.employee_pay_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_break_rules_updated_at
BEFORE UPDATE ON public.break_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();