-- ================================================
-- PHOTO SHARING & REPORTS - PHASE 1: DATABASE FOUNDATION
-- ================================================

-- ==== HELPER FUNCTION: has_any_role ====
-- Check if user has any of the specified roles in their active business
CREATE OR REPLACE FUNCTION public.has_any_role(p_user_id uuid, p_roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.business_memberships bm
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE bm.user_id = p_user_id
      AND bm.business_id = p.active_business_id
      AND bm.status = 'active'
      AND bm.role = ANY(p_roles)
  )
$$;

-- ==== HELPER FUNCTION: generate_secure_share_token ====
-- Generate cryptographically secure token for gallery shares
CREATE OR REPLACE FUNCTION public.generate_secure_share_token()
RETURNS TABLE(token text, token_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text;
  v_hash text;
BEGIN
  -- Generate 24 random bytes, encode as base64url (32 chars)
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_hash := encode(sha256(v_token::bytea), 'hex');
  RETURN QUERY SELECT v_token, v_hash;
END;
$$;

-- ==== HELPER FUNCTION: hash_visitor_identifier ====
-- Privacy-preserving visitor hashing with business-specific salt
CREATE OR REPLACE FUNCTION public.hash_visitor_identifier(p_identifier text, p_business_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_salt text;
BEGIN
  SELECT COALESCE(visitor_hash_salt, id::text) INTO v_salt 
  FROM businesses WHERE id = p_business_id;
  RETURN encode(sha256((p_identifier || v_salt)::bytea), 'hex');
END;
$$;

-- ==== Add visitor_hash_salt to businesses ====
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS visitor_hash_salt text DEFAULT gen_random_uuid()::text;

-- ==== TABLE: photo_gallery_shares ====
CREATE TABLE IF NOT EXISTS public.photo_gallery_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Token (cryptographic security)
  share_token text NOT NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  
  -- Expiration
  expires_at timestamptz,
  is_permanent boolean DEFAULT false,
  permanent_approved_by uuid REFERENCES public.profiles(id),
  permanent_approved_at timestamptz,
  
  -- Content Scope
  include_categories text[] DEFAULT '{}',
  exclude_media_ids uuid[] DEFAULT '{}',
  include_annotations boolean DEFAULT true,
  include_comparisons boolean DEFAULT true,
  
  -- Permissions
  allow_download boolean DEFAULT true,
  allow_comments boolean DEFAULT false,
  require_email boolean DEFAULT false,
  
  -- Branding
  custom_title text,
  custom_message text,
  hide_watermark boolean DEFAULT false,
  
  -- Analytics
  view_count integer DEFAULT 0,
  unique_visitors integer DEFAULT 0,
  last_viewed_at timestamptz,
  download_count integer DEFAULT 0,
  
  -- State
  is_active boolean DEFAULT true,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT permanent_requires_approval CHECK ((is_permanent = false) OR (permanent_approved_by IS NOT NULL)),
  CONSTRAINT custom_title_length CHECK (char_length(custom_title) <= 200),
  CONSTRAINT custom_message_length CHECK (char_length(custom_message) <= 1000),
  CONSTRAINT exclude_media_limit CHECK (cardinality(exclude_media_ids) <= 100)
);

-- Indexes for gallery shares
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_share_token_hash ON public.photo_gallery_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_gallery_share_job_active ON public.photo_gallery_shares(job_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gallery_share_expires ON public.photo_gallery_shares(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_gallery_share_business ON public.photo_gallery_shares(business_id, created_at DESC);

-- RLS for gallery shares
ALTER TABLE public.photo_gallery_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_shares_select" ON public.photo_gallery_shares 
FOR SELECT USING (user_belongs_to_business(business_id));

CREATE POLICY "gallery_shares_insert" ON public.photo_gallery_shares 
FOR INSERT WITH CHECK (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['technician', 'admin', 'owner']::app_role[])
);

CREATE POLICY "gallery_shares_update" ON public.photo_gallery_shares 
FOR UPDATE USING (
  user_belongs_to_business(business_id) AND 
  (created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[]))
);

CREATE POLICY "gallery_shares_delete" ON public.photo_gallery_shares 
FOR DELETE USING (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[])
);

-- Trigger for updated_at
CREATE TRIGGER update_gallery_shares_updated_at 
BEFORE UPDATE ON public.photo_gallery_shares 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==== TABLE: gallery_views ====
CREATE TABLE IF NOT EXISTS public.gallery_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.photo_gallery_shares(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Visitor (privacy-hashed)
  visitor_ip_hash text,
  visitor_email text,
  visitor_fingerprint_hash text,
  
  -- Session
  photos_viewed integer DEFAULT 0,
  time_spent_seconds integer,
  downloaded_photos uuid[] DEFAULT '{}',
  
  -- Context
  referrer_domain text,
  device_type text CHECK (device_type IN ('mobile', 'tablet', 'desktop') OR device_type IS NULL),
  
  -- Timestamps
  viewed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + INTERVAL '90 days')
);

-- Indexes for gallery views
CREATE INDEX IF NOT EXISTS idx_gallery_view_share ON public.gallery_views(share_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_view_retention ON public.gallery_views(expires_at);

-- No RLS on gallery_views - accessed via service role only

-- ==== TABLE: gallery_share_audit_log ====
CREATE TABLE IF NOT EXISTS public.gallery_share_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid REFERENCES public.photo_gallery_shares(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Action
  action text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  actor_ip_hash text,
  
  -- Context
  details jsonb DEFAULT '{}',
  user_agent text,
  
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_share ON public.gallery_share_audit_log(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_business ON public.gallery_share_audit_log(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.gallery_share_audit_log(action, created_at DESC);

-- No RLS on audit log - service role only for security

-- ==== TABLE: photo_comments ====
CREATE TABLE IF NOT EXISTS public.photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_media_id uuid NOT NULL REFERENCES public.job_media(id) ON DELETE CASCADE,
  share_id uuid REFERENCES public.photo_gallery_shares(id) ON DELETE SET NULL,
  
  -- Author
  author_type text NOT NULL CHECK (author_type IN ('customer', 'admin')),
  customer_id uuid REFERENCES public.customers(id),
  admin_id uuid REFERENCES public.profiles(id),
  author_name text NOT NULL,
  author_email text,
  
  -- Content
  comment_text text NOT NULL,
  is_question boolean DEFAULT false,
  
  -- Threading
  parent_comment_id uuid REFERENCES public.photo_comments(id),
  reply_depth integer DEFAULT 0,
  
  -- Status
  is_read boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  hidden_at timestamptz,
  hidden_by uuid REFERENCES public.profiles(id),
  hidden_reason text,
  
  -- Soft delete
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT author_name_length CHECK (char_length(author_name) <= 100),
  CONSTRAINT comment_text_length CHECK (char_length(comment_text) <= 2000),
  CONSTRAINT max_reply_depth CHECK (reply_depth <= 3),
  CONSTRAINT valid_email CHECK (
    author_email IS NULL OR 
    author_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_photo_comment_media ON public.photo_comments(job_media_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_comment_unread ON public.photo_comments(business_id, is_read) WHERE is_read = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_comment_share ON public.photo_comments(share_id) WHERE share_id IS NOT NULL;

-- RLS for comments
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_comments_select" ON public.photo_comments 
FOR SELECT USING (user_belongs_to_business(business_id) AND deleted_at IS NULL);

CREATE POLICY "photo_comments_insert" ON public.photo_comments 
FOR INSERT WITH CHECK (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['technician', 'admin', 'owner']::app_role[])
);

CREATE POLICY "photo_comments_update" ON public.photo_comments 
FOR UPDATE USING (
  user_belongs_to_business(business_id) AND 
  deleted_at IS NULL AND
  (admin_id = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[]))
);

CREATE POLICY "photo_comments_delete" ON public.photo_comments 
FOR DELETE USING (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[])
);

-- Trigger for updated_at
CREATE TRIGGER update_photo_comments_updated_at 
BEFORE UPDATE ON public.photo_comments 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==== TABLE: photo_reports ====
CREATE TABLE IF NOT EXISTS public.photo_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Idempotency
  idempotency_key text,
  
  -- Report Configuration
  report_type text NOT NULL CHECK (report_type IN ('standard', 'before_after', 'detailed', 'custom')),
  title text NOT NULL,
  include_media_ids uuid[] DEFAULT '{}',
  include_annotations boolean DEFAULT true,
  include_comparisons boolean DEFAULT true,
  include_descriptions boolean DEFAULT true,
  include_timestamps boolean DEFAULT true,
  include_gps boolean DEFAULT false,
  photos_per_page integer DEFAULT 4 CHECK (photos_per_page BETWEEN 1 AND 12),
  
  -- Layout
  layout text DEFAULT 'grid' CHECK (layout IN ('grid', 'timeline', 'before_after', 'single')),
  orientation text DEFAULT 'portrait' CHECK (orientation IN ('portrait', 'landscape')),
  paper_size text DEFAULT 'letter' CHECK (paper_size IN ('letter', 'a4')),
  
  -- Generated Output
  storage_path text,
  storage_bucket text DEFAULT 'reports',
  file_url text,
  file_size_bytes bigint,
  page_count integer,
  
  -- Queue state
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'generating', 'ready', 'failed', 'expired')),
  queue_position integer,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  error_code text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  
  -- Retention
  expires_at timestamptz DEFAULT (now() + INTERVAL '30 days'),
  
  -- Metadata
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT title_length CHECK (char_length(title) <= 200),
  CONSTRAINT media_limit CHECK (cardinality(include_media_ids) <= 100)
);

-- Indexes for reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_report_idempotency ON public.photo_reports(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photo_report_job ON public.photo_reports(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_report_status ON public.photo_reports(status, created_at) WHERE status IN ('pending', 'queued', 'generating');
CREATE INDEX IF NOT EXISTS idx_photo_report_retention ON public.photo_reports(expires_at) WHERE status = 'ready';

-- RLS for reports
ALTER TABLE public.photo_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_reports_select" ON public.photo_reports 
FOR SELECT USING (user_belongs_to_business(business_id));

CREATE POLICY "photo_reports_insert" ON public.photo_reports 
FOR INSERT WITH CHECK (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['technician', 'admin', 'owner']::app_role[])
);

CREATE POLICY "photo_reports_update" ON public.photo_reports 
FOR UPDATE USING (
  user_belongs_to_business(business_id) AND 
  (created_by = auth.uid() OR has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[]))
);

CREATE POLICY "photo_reports_delete" ON public.photo_reports 
FOR DELETE USING (
  user_belongs_to_business(business_id) AND 
  has_any_role(auth.uid(), ARRAY['admin', 'owner']::app_role[])
);

-- ==== TABLE: report_generation_queue ====
CREATE TABLE IF NOT EXISTS public.report_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES public.photo_reports(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Queue state
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  priority integer DEFAULT 0,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  
  -- Processing
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Error tracking
  last_error text,
  error_history jsonb DEFAULT '[]',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for queue
CREATE INDEX IF NOT EXISTS idx_queue_pending ON public.report_generation_queue(priority DESC, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_processing ON public.report_generation_queue(lock_expires_at) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_queue_dead_letter ON public.report_generation_queue(created_at) WHERE status = 'dead_letter';

-- No RLS on queue - service role only

-- ==== TABLE: gallery_brandings ====
CREATE TABLE IF NOT EXISTS public.gallery_brandings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  
  -- Logo & Images
  logo_url text,
  background_image_url text,
  favicon_url text,
  
  -- Colors
  primary_color text DEFAULT '#2563eb',
  secondary_color text DEFAULT '#64748b',
  background_color text DEFAULT '#ffffff',
  text_color text DEFAULT '#1e293b',
  
  -- Typography
  heading_font text DEFAULT 'Inter',
  body_font text DEFAULT 'Inter',
  
  -- Content
  gallery_title_template text DEFAULT 'Photo Gallery - Job #{job_number}',
  footer_text text,
  contact_info text,
  
  -- Features
  show_powered_by boolean DEFAULT true,
  show_job_details boolean DEFAULT true,
  show_date boolean DEFAULT true,
  show_address boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_primary_color CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT valid_secondary_color CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT valid_background_color CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT valid_text_color CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT title_template_length CHECK (char_length(gallery_title_template) <= 200),
  CONSTRAINT footer_length CHECK (char_length(footer_text) <= 500),
  CONSTRAINT contact_length CHECK (char_length(contact_info) <= 500),
  CONSTRAINT valid_heading_font CHECK (heading_font IN ('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display')),
  CONSTRAINT valid_body_font CHECK (body_font IN ('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'))
);

-- RLS for branding
ALTER TABLE public.gallery_brandings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_brandings_all" ON public.gallery_brandings 
FOR ALL USING (user_belongs_to_business(business_id));

-- Trigger for updated_at
CREATE TRIGGER update_gallery_brandings_updated_at 
BEFORE UPDATE ON public.gallery_brandings 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==== EXTENSION COLUMNS ====

-- Jobs table extensions
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS active_gallery_share_id uuid REFERENCES public.photo_gallery_shares(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS has_active_gallery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS gallery_view_count integer DEFAULT 0;

-- Quotes table extensions  
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS embedded_gallery_id uuid REFERENCES public.photo_gallery_shares(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS show_photos boolean DEFAULT false;

-- Invoices table extensions
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS embedded_gallery_id uuid REFERENCES public.photo_gallery_shares(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS show_photos boolean DEFAULT false;

-- Customers table extensions
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS total_photos_accessible integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_gallery_view_at timestamptz;

-- ==== HELPER FUNCTION: increment_gallery_views_atomic ====
CREATE OR REPLACE FUNCTION public.increment_gallery_views_atomic(p_share_id uuid, p_fingerprint_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_unique boolean;
BEGIN
  -- Check if fingerprint seen in last 24h
  SELECT NOT EXISTS(
    SELECT 1 FROM gallery_views 
    WHERE share_id = p_share_id 
      AND visitor_fingerprint_hash = p_fingerprint_hash 
      AND viewed_at > NOW() - INTERVAL '24 hours'
  ) INTO v_is_unique;
  
  -- Atomic counter update
  UPDATE photo_gallery_shares 
  SET 
    view_count = view_count + 1,
    unique_visitors = CASE WHEN v_is_unique THEN unique_visitors + 1 ELSE unique_visitors END,
    last_viewed_at = NOW()
  WHERE id = p_share_id;
  
  RETURN v_is_unique;
END;
$$;

-- ==== CLEANUP FUNCTION: cleanup_expired_gallery_data ====
CREATE OR REPLACE FUNCTION public.cleanup_expired_gallery_data()
RETURNS TABLE(views_deleted integer, reports_expired integer, shares_deactivated integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_views integer;
  v_reports integer;
  v_shares integer;
BEGIN
  -- Delete expired gallery views (90 day retention)
  WITH deleted AS (
    DELETE FROM gallery_views WHERE expires_at < NOW() RETURNING id
  )
  SELECT count(*) INTO v_views FROM deleted;
  
  -- Mark expired reports
  WITH updated AS (
    UPDATE photo_reports 
    SET status = 'expired' 
    WHERE status = 'ready' AND expires_at < NOW()
    RETURNING id
  )
  SELECT count(*) INTO v_reports FROM updated;
  
  -- Deactivate expired shares
  WITH updated AS (
    UPDATE photo_gallery_shares 
    SET is_active = false 
    WHERE is_active = true 
      AND expires_at IS NOT NULL 
      AND expires_at < NOW() 
      AND is_permanent = false
    RETURNING id
  )
  SELECT count(*) INTO v_shares FROM updated;
  
  -- Update jobs with deactivated shares
  UPDATE jobs j 
  SET has_active_gallery = false, active_gallery_share_id = NULL
  WHERE active_gallery_share_id IN (
    SELECT id FROM photo_gallery_shares WHERE is_active = false
  );
  
  RETURN QUERY SELECT v_views, v_reports, v_shares;
END;
$$;

-- ==== CLEANUP FUNCTION: release_stale_queue_locks ====
CREATE OR REPLACE FUNCTION public.release_stale_queue_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE report_generation_queue
    SET 
      status = 'pending',
      locked_by = NULL,
      locked_at = NULL,
      lock_expires_at = NULL,
      attempts = attempts + 1
    WHERE status = 'processing' AND lock_expires_at < NOW()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  
  -- Move to dead letter if max attempts exceeded
  UPDATE report_generation_queue
  SET status = 'dead_letter'
  WHERE status = 'pending' AND attempts >= max_attempts;
  
  RETURN v_count;
END;
$$;

-- ==== STORAGE BUCKET: reports ====
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reports', 'reports', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for reports bucket
CREATE POLICY "reports_select" ON storage.objects 
FOR SELECT USING (bucket_id = 'reports' AND (
  EXISTS (
    SELECT 1 FROM photo_reports pr 
    WHERE pr.storage_path = name 
      AND user_belongs_to_business(pr.business_id)
  )
));

CREATE POLICY "reports_insert" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'reports');

CREATE POLICY "reports_delete" ON storage.objects 
FOR DELETE USING (bucket_id = 'reports');

-- ==== PG_CRON JOBS ====
-- Cleanup expired gallery data hourly
SELECT cron.schedule(
  'cleanup-gallery-data',
  '0 * * * *',
  $$SELECT public.cleanup_expired_gallery_data()$$
);

-- Release stale queue locks every 5 minutes
SELECT cron.schedule(
  'release-stale-report-locks',
  '*/5 * * * *',
  $$SELECT public.release_stale_queue_locks()$$
);