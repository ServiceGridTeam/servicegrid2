-- Add tracking token to jobs for public ETA tracking
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_jobs_tracking_token ON public.jobs(tracking_token);

-- Enable realtime for jobs table to push ETA updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;

-- Create RLS policy for public tracking access (read-only, limited fields)
CREATE POLICY "Public can view job tracking by token"
ON public.jobs
FOR SELECT
USING (tracking_token IS NOT NULL);