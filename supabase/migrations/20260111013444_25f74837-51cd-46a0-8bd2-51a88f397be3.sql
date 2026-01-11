-- Phase 5: PDF Report Generation Helper Functions

-- validate_share_token: Constant-time token validation
CREATE OR REPLACE FUNCTION public.validate_share_token(p_token text)
RETURNS TABLE(share_id uuid, is_valid boolean, error_code text) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_share RECORD;
BEGIN
  -- Hash token for lookup
  v_token_hash := encode(sha256(p_token::bytea), 'hex');
  
  SELECT * INTO v_share
  FROM photo_gallery_shares
  WHERE token_hash = v_token_hash;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, 'NOT_FOUND'::text;
    RETURN;
  END IF;
  
  IF NOT v_share.is_active THEN
    RETURN QUERY SELECT v_share.id, false, 'REVOKED'::text;
    RETURN;
  END IF;
  
  IF v_share.expires_at IS NOT NULL AND v_share.expires_at < NOW() THEN
    RETURN QUERY SELECT v_share.id, false, 'EXPIRED'::text;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT v_share.id, true, NULL::text;
END;
$$;

-- enqueue_report_generation: Add report to queue with idempotency
CREATE OR REPLACE FUNCTION public.enqueue_report_generation(
  p_report_id uuid,
  p_business_id uuid,
  p_priority integer DEFAULT 0
) RETURNS uuid 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue_id uuid;
BEGIN
  INSERT INTO report_generation_queue (
    report_id, business_id, priority, status
  ) VALUES (
    p_report_id, p_business_id, p_priority, 'pending'
  )
  ON CONFLICT (report_id) DO UPDATE
  SET priority = GREATEST(report_generation_queue.priority, EXCLUDED.priority),
      updated_at = NOW()
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

-- cleanup_expired_report_files: Mark expired files for cleanup and return paths
CREATE OR REPLACE FUNCTION public.cleanup_expired_report_files()
RETURNS TABLE(files_marked integer, storage_paths text[]) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_paths text[];
BEGIN
  -- Get paths before clearing them
  SELECT array_agg(storage_path) INTO v_paths
  FROM photo_reports
  WHERE status = 'expired' AND storage_path IS NOT NULL;
  
  -- Clear the paths
  WITH updated AS (
    UPDATE photo_reports
    SET storage_path = NULL, file_url = NULL
    WHERE status = 'expired' AND storage_path IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM updated;
  
  RETURN QUERY SELECT v_count, COALESCE(v_paths, ARRAY[]::text[]);
END;
$$;

-- Create reports storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for reports bucket
CREATE POLICY "Users can read reports for their business"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reports' AND
  EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.user_id = auth.uid()
    AND bm.status = 'active'
    AND bm.business_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Service role can manage reports"
ON storage.objects FOR ALL
USING (bucket_id = 'reports')
WITH CHECK (bucket_id = 'reports');