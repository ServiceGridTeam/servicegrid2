-- Create time_entries table for clock in/out and timesheet tracking
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out TIMESTAMPTZ,
  notes TEXT,
  entry_type TEXT DEFAULT 'work' CHECK (entry_type IN ('work', 'break', 'travel')),
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_time_entries_job ON public.time_entries(job_id);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_business ON public.time_entries(business_id);
CREATE INDEX idx_time_entries_clock_in ON public.time_entries(clock_in);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view time entries in their business"
ON public.time_entries
FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage their own time entries"
ON public.time_entries
FOR ALL
USING (user_belongs_to_business(business_id) AND (user_id = auth.uid() OR has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)));