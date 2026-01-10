-- Add soft delete support to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create media metrics table for observability
CREATE TABLE IF NOT EXISTS media_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  uploads_count integer DEFAULT 0,
  storage_bytes bigint DEFAULT 0,
  thumbnails_bytes bigint DEFAULT 0,
  scans_clean integer DEFAULT 0,
  scans_rejected integer DEFAULT 0,
  cleanup_deleted integer DEFAULT 0,
  cleanup_bytes_reclaimed bigint DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, metric_date)
);

-- Enable RLS
ALTER TABLE media_metrics ENABLE ROW LEVEL SECURITY;

-- Allow business members to view their metrics
CREATE POLICY "Business members can view media metrics"
  ON media_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships
      WHERE business_memberships.business_id = media_metrics.business_id
      AND business_memberships.user_id = auth.uid()
      AND business_memberships.status = 'active'
    )
  );

-- Allow service role to insert/update metrics (edge functions)
CREATE POLICY "Service role can manage media metrics"
  ON media_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for efficient date-range queries
CREATE INDEX IF NOT EXISTS idx_media_metrics_date ON media_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_media_metrics_business ON media_metrics(business_id, metric_date DESC);

-- Schedule cleanup jobs via pg_cron
-- Cleanup orphaned media daily at 3am UTC
SELECT cron.schedule(
  'cleanup-orphaned-media',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-orphaned-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cleanup unconverted uploads daily at 4am UTC
SELECT cron.schedule(
  'cleanup-unconverted-uploads',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cleanup-unconverted-uploads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cleanup expired rate limits daily at 5am UTC (simple SQL, no edge function needed)
SELECT cron.schedule(
  'cleanup-expired-rate-limits',
  '0 5 * * *',
  $$DELETE FROM upload_rate_limits WHERE window_start < now() - interval '24 hours'$$
);

-- Compute media metrics daily at 6am UTC
SELECT cron.schedule(
  'compute-media-metrics',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/media-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);