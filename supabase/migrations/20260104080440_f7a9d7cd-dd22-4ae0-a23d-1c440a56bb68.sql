-- Create job_assignments table for N:M relationship between jobs and profiles
CREATE TABLE public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  role TEXT DEFAULT 'assigned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_job_assignments_job ON public.job_assignments(job_id);
CREATE INDEX idx_job_assignments_user ON public.job_assignments(user_id);
CREATE INDEX idx_job_assignments_business ON public.job_assignments(business_id);

-- Enable RLS
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view job assignments in their business"
ON public.job_assignments FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage job assignments in their business"
ON public.job_assignments FOR ALL
USING (user_belongs_to_business(business_id));