-- Rate limiting table for customer uploads
CREATE TABLE upload_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  identifier_type text NOT NULL CHECK (identifier_type IN ('ip', 'session', 'business')),
  count integer DEFAULT 0,
  window_start timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_identifier ON upload_rate_limits(identifier, identifier_type);
CREATE INDEX idx_rate_limits_window ON upload_rate_limits(window_start);

-- Auto-cleanup old entries function
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM upload_rate_limits 
  WHERE window_start < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Enable RLS
ALTER TABLE upload_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limits (edge functions use service role)
CREATE POLICY "Service role can manage rate limits"
ON upload_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);