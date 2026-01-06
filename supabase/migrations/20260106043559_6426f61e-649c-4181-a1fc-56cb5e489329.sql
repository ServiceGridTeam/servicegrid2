-- Create phone_integration_logs table
CREATE TABLE public.phone_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES phone_integrations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_code TEXT,
  duration_ms INTEGER,
  request_metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_phone_logs_business_created ON phone_integration_logs(business_id, created_at DESC);
CREATE INDEX idx_phone_logs_integration_id ON phone_integration_logs(integration_id);

-- Enable RLS
ALTER TABLE phone_integration_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Business members can view logs
CREATE POLICY "Business members can view logs"
  ON phone_integration_logs FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Policy: Allow inserts from edge functions (service role)
CREATE POLICY "Service can insert logs"
  ON phone_integration_logs FOR INSERT
  WITH CHECK (true);