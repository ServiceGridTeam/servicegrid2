-- =====================================================
-- Email-to-Request Feature: Database Schema Migration
-- =====================================================

-- 1. Update job_requests source constraint to include 'email'
ALTER TABLE job_requests
  DROP CONSTRAINT IF EXISTS job_requests_source_check;

ALTER TABLE job_requests
  ADD CONSTRAINT job_requests_source_check 
    CHECK (source IN ('phone', 'web', 'walk-in', 'email'));

-- Add email-specific columns to job_requests
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS source_email_id UUID,
  ADD COLUMN IF NOT EXISTS source_email_thread_id TEXT;

CREATE INDEX IF NOT EXISTS idx_job_requests_email_source 
  ON job_requests(source_email_id) 
  WHERE source = 'email';

-- 2. Create email_connections table (Gmail OAuth connections)
CREATE TABLE IF NOT EXISTS public.email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook')),
  email_address TEXT NOT NULL,
  
  -- Encrypted OAuth tokens (table-based encryption for now)
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Adaptive polling configuration
  poll_interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (poll_interval_seconds BETWEEN 30 AND 300),
  last_sync_at TIMESTAMPTZ,
  last_sync_message_id TEXT,
  
  -- Classification configuration
  classification_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.85 CHECK (classification_threshold BETWEEN 0 AND 1),
  auto_create_requests BOOLEAN NOT NULL DEFAULT false,
  auto_acknowledge BOOLEAN NOT NULL DEFAULT false,
  
  -- Health and status
  connection_health TEXT NOT NULL DEFAULT 'healthy' CHECK (connection_health IN ('healthy', 'warning', 'error')),
  sync_errors_count INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT,
  last_error_at TIMESTAMPTZ,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(business_id, email_address)
);

-- 3. Create email_rules table (user-defined classification rules)
CREATE TABLE IF NOT EXISTS public.email_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES email_connections(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Rule conditions (array of {field, operator, value})
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Action to take
  action TEXT NOT NULL DEFAULT 'classify' CHECK (action IN ('classify', 'spam', 'ignore', 'auto_reply')),
  action_config JSONB DEFAULT '{}'::jsonb,
  
  -- Learning metadata
  created_from_correction BOOLEAN NOT NULL DEFAULT false,
  times_matched INTEGER NOT NULL DEFAULT 0,
  last_matched_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_rules_business_priority 
  ON email_rules(business_id, priority DESC) 
  WHERE is_active = true;

-- 4. Create inbound_emails table (fetched emails with classification)
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  
  -- Provider identifiers
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  
  -- Email content
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  
  -- Classification results
  classification TEXT CHECK (classification IN ('service_request', 'inquiry', 'spam', 'out_of_scope', 'unclassified')),
  classification_confidence NUMERIC(3,2) CHECK (classification_confidence BETWEEN 0 AND 1),
  classification_tier TEXT CHECK (classification_tier IN ('ai', 'rules', 'keywords')),
  classification_stage TEXT NOT NULL DEFAULT 'pending' CHECK (classification_stage IN ('pending', 'analyzing', 'reading', 'extracting', 'complete', 'failed')),
  classified_at TIMESTAMPTZ,
  
  -- AI-extracted data
  ai_extracted_data JSONB DEFAULT '{}'::jsonb,
  
  -- Deduplication
  content_hash TEXT NOT NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of_id UUID REFERENCES inbound_emails(id),
  
  -- Status and linking
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'processed', 'spam', 'ignored', 'request_created')),
  job_request_id UUID REFERENCES job_requests(id),
  
  -- Metadata
  raw_headers JSONB,
  attachments JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(connection_id, provider_message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_business_status 
  ON inbound_emails(business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbound_emails_thread 
  ON inbound_emails(thread_id) 
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inbound_emails_content_hash 
  ON inbound_emails(content_hash, from_address, created_at DESC);

-- 5. Create email_reply_templates table
CREATE TABLE IF NOT EXISTS public.email_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  
  -- Template variables
  variables JSONB DEFAULT '["customer_name", "service_type", "business_name"]'::jsonb,
  
  is_default BOOLEAN NOT NULL DEFAULT false,
  use_for_auto_acknowledge BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create check_email_duplicate function
CREATE OR REPLACE FUNCTION public.check_email_duplicate(
  p_thread_id TEXT,
  p_content_hash TEXT,
  p_from_address TEXT,
  p_connection_id UUID
)
RETURNS TABLE (
  is_duplicate BOOLEAN,
  duplicate_of_id UUID,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_reason TEXT;
BEGIN
  -- Check 1: Thread already has a job_request
  IF p_thread_id IS NOT NULL THEN
    SELECT ie.id INTO v_existing_id
    FROM inbound_emails ie
    WHERE ie.thread_id = p_thread_id
      AND ie.connection_id = p_connection_id
      AND ie.job_request_id IS NOT NULL
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      RETURN QUERY SELECT true, v_existing_id, 'thread_has_request'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Check 2: Same content hash from same sender in last 24h
  SELECT ie.id INTO v_existing_id
  FROM inbound_emails ie
  WHERE ie.content_hash = p_content_hash
    AND ie.from_address = p_from_address
    AND ie.connection_id = p_connection_id
    AND ie.created_at > now() - INTERVAL '24 hours'
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing_id, 'duplicate_content'::TEXT;
    RETURN;
  END IF;
  
  -- No duplicate found
  RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT;
END;
$$;

-- 7. Create updated_at triggers
CREATE OR REPLACE FUNCTION public.update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON email_connections
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

CREATE TRIGGER update_email_rules_updated_at
  BEFORE UPDATE ON email_rules
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

CREATE TRIGGER update_inbound_emails_updated_at
  BEFORE UPDATE ON inbound_emails
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

CREATE TRIGGER update_email_reply_templates_updated_at
  BEFORE UPDATE ON email_reply_templates
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

-- 8. Enable RLS on all tables
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_reply_templates ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies using business_memberships pattern
CREATE POLICY "Users can view email connections for their businesses"
  ON email_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_connections.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "Admins can manage email connections"
  ON email_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_connections.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view email rules for their businesses"
  ON email_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_rules.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "Admins can manage email rules"
  ON email_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_rules.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view inbound emails for their businesses"
  ON inbound_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = inbound_emails.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "Users can update inbound emails for their businesses"
  ON inbound_emails FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = inbound_emails.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "System can insert inbound emails"
  ON inbound_emails FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view email templates for their businesses"
  ON email_reply_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_reply_templates.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "Admins can manage email templates"
  ON email_reply_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.business_id = email_reply_templates.business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('owner', 'admin')
    )
  );

-- 10. Enable realtime for inbound_emails (for classification_stage updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.inbound_emails;