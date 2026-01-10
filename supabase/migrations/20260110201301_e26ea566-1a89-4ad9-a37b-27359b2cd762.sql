-- =============================================
-- Photo Annotations & Markup - Database Foundation
-- Part 3 of Field Photo Documentation System
-- =============================================

-- 1. Create media_annotations table for storing annotation data with versioning
CREATE TABLE public.media_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_media_id UUID NOT NULL REFERENCES public.job_media(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Version tracking
  version INTEGER NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES public.media_annotations(id) ON DELETE SET NULL,
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  -- Annotation data (JSON with canvas objects)
  annotation_data JSONB NOT NULL DEFAULT '{"version": 1, "objects": [], "canvas": {"width": 0, "height": 0}}'::jsonb,
  
  -- Rendered output
  rendered_url TEXT,
  rendered_at TIMESTAMPTZ,
  render_error TEXT,
  
  -- Author info
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  
  -- Summary flags for quick filtering
  object_count INTEGER NOT NULL DEFAULT 0,
  has_text BOOLEAN NOT NULL DEFAULT false,
  has_arrows BOOLEAN NOT NULL DEFAULT false,
  has_shapes BOOLEAN NOT NULL DEFAULT false,
  has_measurements BOOLEAN NOT NULL DEFAULT false,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: annotation_data must be <= 1MB
  CONSTRAINT annotation_data_size_limit CHECK (octet_length(annotation_data::text) <= 1048576)
);

-- Unique constraint: only one current annotation per media
CREATE UNIQUE INDEX idx_media_annotations_current 
  ON public.media_annotations(job_media_id) 
  WHERE is_current = true AND deleted_at IS NULL;

-- Index for version history queries
CREATE INDEX idx_media_annotations_history 
  ON public.media_annotations(job_media_id, version DESC);

-- Index for business-level queries
CREATE INDEX idx_media_annotations_business 
  ON public.media_annotations(business_id, created_at DESC);

-- 2. Create before_after_comparisons table
CREATE TABLE public.before_after_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Photo pairing
  before_media_id UUID NOT NULL REFERENCES public.job_media(id) ON DELETE CASCADE,
  after_media_id UUID NOT NULL REFERENCES public.job_media(id) ON DELETE CASCADE,
  
  -- Display settings
  title TEXT,
  description TEXT,
  display_mode TEXT NOT NULL DEFAULT 'slider' CHECK (display_mode IN ('slider', 'side_by_side', 'fade')),
  
  -- Alignment/crop data
  before_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 100, "height": 100, "scale": 1}'::jsonb,
  after_crop JSONB DEFAULT '{"x": 0, "y": 0, "width": 100, "height": 100, "scale": 1}'::jsonb,
  
  -- Sharing
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  share_expires_at TIMESTAMPTZ,
  
  -- Author
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: before and after must be different photos
  CONSTRAINT different_photos CHECK (before_media_id != after_media_id)
);

-- Unique constraint: one comparison per photo pair per job
CREATE UNIQUE INDEX idx_comparisons_unique_pair 
  ON public.before_after_comparisons(job_id, before_media_id, after_media_id) 
  WHERE deleted_at IS NULL;

-- Index for share token lookups
CREATE INDEX idx_comparisons_share_token 
  ON public.before_after_comparisons(share_token) 
  WHERE share_token IS NOT NULL;

-- Index for job-level queries
CREATE INDEX idx_comparisons_job 
  ON public.before_after_comparisons(job_id, created_at DESC);

-- 3. Create annotation_locks table for concurrency control
CREATE TABLE public.annotation_locks (
  job_media_id UUID NOT NULL PRIMARY KEY REFERENCES public.job_media(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_by_name TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for cleanup of expired locks
CREATE INDEX idx_annotation_locks_expires 
  ON public.annotation_locks(expires_at);

-- 4. Create annotation_audit_log table (immutable)
CREATE TABLE public.annotation_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Target references (one of these will be set)
  annotation_id UUID REFERENCES public.media_annotations(id) ON DELETE SET NULL,
  comparison_id UUID REFERENCES public.before_after_comparisons(id) ON DELETE SET NULL,
  
  -- Action info
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore', 'share', 'unshare', 'revert')),
  target_type TEXT NOT NULL CHECK (target_type IN ('annotation', 'comparison')),
  
  -- Actor info
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  
  -- Change details
  changes JSONB,
  metadata JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for audit queries
CREATE INDEX idx_annotation_audit_business 
  ON public.annotation_audit_log(business_id, created_at DESC);

CREATE INDEX idx_annotation_audit_annotation 
  ON public.annotation_audit_log(annotation_id, created_at DESC) 
  WHERE annotation_id IS NOT NULL;

CREATE INDEX idx_annotation_audit_comparison 
  ON public.annotation_audit_log(comparison_id, created_at DESC) 
  WHERE comparison_id IS NOT NULL;

-- 5. Create render_jobs table for background rendering queue
CREATE TABLE public.render_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annotation_id UUID NOT NULL REFERENCES public.media_annotations(id) ON DELETE CASCADE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 0,
  
  -- Retry logic
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for queue processing
CREATE INDEX idx_render_jobs_queue 
  ON public.render_jobs(status, priority DESC, created_at ASC) 
  WHERE status IN ('pending', 'failed');

-- 6. Extend job_media table with annotation tracking
ALTER TABLE public.job_media 
  ADD COLUMN IF NOT EXISTS has_annotations BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annotation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_annotation_id UUID REFERENCES public.media_annotations(id) ON DELETE SET NULL;

-- 7. Extend jobs table with comparison tracking
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS comparison_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_before_after BOOLEAN NOT NULL DEFAULT false;

-- =============================================
-- Helper Functions
-- =============================================

-- 8. Acquire annotation lock function
CREATE OR REPLACE FUNCTION public.acquire_annotation_lock(
  p_media_id UUID,
  p_user_id UUID,
  p_ttl_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_lock RECORD;
  v_user_name TEXT;
  v_now TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get user name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Unknown')
  INTO v_user_name
  FROM profiles
  WHERE id = p_user_id;
  
  -- Calculate expiry
  v_expires_at := v_now + (p_ttl_seconds || ' seconds')::interval;
  
  -- Check for existing lock
  SELECT * INTO v_existing_lock
  FROM annotation_locks
  WHERE job_media_id = p_media_id;
  
  IF v_existing_lock IS NOT NULL THEN
    -- Check if lock is expired
    IF v_existing_lock.expires_at < v_now THEN
      -- Lock expired, take it over
      UPDATE annotation_locks
      SET locked_by = p_user_id,
          locked_by_name = v_user_name,
          locked_at = v_now,
          expires_at = v_expires_at
      WHERE job_media_id = p_media_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'expires_at', v_expires_at,
        'message', 'Lock acquired (previous lock expired)'
      );
    ELSIF v_existing_lock.locked_by = p_user_id THEN
      -- User already has the lock, extend it
      UPDATE annotation_locks
      SET expires_at = v_expires_at
      WHERE job_media_id = p_media_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'expires_at', v_expires_at,
        'message', 'Lock extended'
      );
    ELSE
      -- Lock held by another user
      RETURN jsonb_build_object(
        'success', false,
        'locked_by', v_existing_lock.locked_by,
        'locked_by_name', v_existing_lock.locked_by_name,
        'expires_at', v_existing_lock.expires_at,
        'message', 'Photo is being edited by ' || v_existing_lock.locked_by_name
      );
    END IF;
  END IF;
  
  -- No existing lock, create new one
  INSERT INTO annotation_locks (job_media_id, locked_by, locked_by_name, expires_at)
  VALUES (p_media_id, p_user_id, v_user_name, v_expires_at);
  
  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'message', 'Lock acquired'
  );
END;
$$;

-- 9. Release annotation lock function
CREATE OR REPLACE FUNCTION public.release_annotation_lock(
  p_media_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM annotation_locks
  WHERE job_media_id = p_media_id
    AND locked_by = p_user_id;
  
  RETURN FOUND;
END;
$$;

-- 10. Save annotation version function
CREATE OR REPLACE FUNCTION public.save_annotation_version(
  p_media_id UUID,
  p_annotation_data JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_current_annotation RECORD;
  v_new_version INTEGER;
  v_new_annotation_id UUID;
  v_user_name TEXT;
  v_object_count INTEGER;
  v_has_text BOOLEAN := false;
  v_has_arrows BOOLEAN := false;
  v_has_shapes BOOLEAN := false;
  v_has_measurements BOOLEAN := false;
  v_obj JSONB;
BEGIN
  -- Get business_id from job_media
  SELECT jm.business_id INTO v_business_id
  FROM job_media jm
  WHERE jm.id = p_media_id;
  
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Photo not found');
  END IF;
  
  -- Get user name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Unknown')
  INTO v_user_name
  FROM profiles
  WHERE id = p_user_id;
  
  -- Get current annotation if exists
  SELECT * INTO v_current_annotation
  FROM media_annotations
  WHERE job_media_id = p_media_id
    AND is_current = true
    AND deleted_at IS NULL;
  
  -- Calculate new version number
  v_new_version := COALESCE(v_current_annotation.version, 0) + 1;
  
  -- Analyze annotation objects for summary flags
  v_object_count := jsonb_array_length(COALESCE(p_annotation_data->'objects', '[]'::jsonb));
  
  FOR v_obj IN SELECT * FROM jsonb_array_elements(COALESCE(p_annotation_data->'objects', '[]'::jsonb))
  LOOP
    CASE v_obj->>'type'
      WHEN 'text' THEN v_has_text := true;
      WHEN 'arrow' THEN v_has_arrows := true;
      WHEN 'measurement' THEN v_has_measurements := true;
      WHEN 'rect', 'circle', 'ellipse', 'line', 'freehand' THEN v_has_shapes := true;
      ELSE NULL;
    END CASE;
  END LOOP;
  
  -- Mark current annotation as not current
  IF v_current_annotation.id IS NOT NULL THEN
    UPDATE media_annotations
    SET is_current = false,
        updated_at = now()
    WHERE id = v_current_annotation.id;
  END IF;
  
  -- Insert new annotation version
  INSERT INTO media_annotations (
    job_media_id, business_id, version, parent_version_id, is_current,
    annotation_data, created_by, created_by_name,
    object_count, has_text, has_arrows, has_shapes, has_measurements
  )
  VALUES (
    p_media_id, v_business_id, v_new_version, v_current_annotation.id, true,
    p_annotation_data, p_user_id, v_user_name,
    v_object_count, v_has_text, v_has_arrows, v_has_shapes, v_has_measurements
  )
  RETURNING id INTO v_new_annotation_id;
  
  -- Update job_media stats
  UPDATE job_media
  SET has_annotations = true,
      annotation_count = v_new_version,
      current_annotation_id = v_new_annotation_id,
      updated_at = now()
  WHERE id = p_media_id;
  
  -- Create audit log entry
  INSERT INTO annotation_audit_log (
    business_id, annotation_id, action, target_type, actor_id, actor_name,
    changes, metadata
  )
  VALUES (
    v_business_id, v_new_annotation_id,
    CASE WHEN v_current_annotation.id IS NULL THEN 'create' ELSE 'update' END,
    'annotation', p_user_id, v_user_name,
    jsonb_build_object(
      'version', v_new_version,
      'object_count', v_object_count,
      'parent_version_id', v_current_annotation.id
    ),
    jsonb_build_object('media_id', p_media_id)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'annotation_id', v_new_annotation_id,
    'version', v_new_version,
    'message', 'Annotation saved'
  );
END;
$$;

-- 11. Cleanup expired locks function (for pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_annotation_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM annotation_locks
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 12. Generate secure share token function
CREATE OR REPLACE FUNCTION public.generate_comparison_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate 32 bytes (256 bits) of random data, encode as base64url
  RETURN replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
END;
$$;

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.media_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.before_after_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;

-- media_annotations policies
CREATE POLICY "Users can view annotations in their business"
  ON public.media_annotations FOR SELECT
  USING (
    deleted_at IS NULL
    AND business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Tech/Admin/Owner can create annotations"
  ON public.media_annotations FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('technician', 'admin', 'owner')
    )
  );

CREATE POLICY "Author or Admin/Owner can update annotations"
  ON public.media_annotations FOR UPDATE
  USING (
    business_id IN (
      SELECT bm.business_id FROM business_memberships bm
      WHERE bm.user_id = auth.uid() 
        AND bm.status = 'active'
        AND (
          created_by = auth.uid()
          OR bm.role IN ('admin', 'owner')
        )
    )
  );

CREATE POLICY "Admin/Owner can delete annotations"
  ON public.media_annotations FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('admin', 'owner')
    )
  );

-- before_after_comparisons policies
CREATE POLICY "Users can view comparisons in their business or via share token"
  ON public.before_after_comparisons FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- Business member access
      business_id IN (
        SELECT business_id FROM business_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
      -- Public share token access is handled at application level
    )
  );

CREATE POLICY "Tech/Admin/Owner can create comparisons"
  ON public.before_after_comparisons FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('technician', 'admin', 'owner')
    )
  );

CREATE POLICY "Author or Admin/Owner can update comparisons"
  ON public.before_after_comparisons FOR UPDATE
  USING (
    business_id IN (
      SELECT bm.business_id FROM business_memberships bm
      WHERE bm.user_id = auth.uid() 
        AND bm.status = 'active'
        AND (
          created_by = auth.uid()
          OR bm.role IN ('admin', 'owner')
        )
    )
  );

CREATE POLICY "Admin/Owner can delete comparisons"
  ON public.before_after_comparisons FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('admin', 'owner')
    )
  );

-- annotation_locks policies
CREATE POLICY "Users can view locks in their business"
  ON public.annotation_locks FOR SELECT
  USING (
    job_media_id IN (
      SELECT jm.id FROM job_media jm
      WHERE jm.business_id IN (
        SELECT business_id FROM business_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Users can manage their own locks"
  ON public.annotation_locks FOR ALL
  USING (locked_by = auth.uid());

-- annotation_audit_log policies (read-only for business members)
CREATE POLICY "Users can view audit logs in their business"
  ON public.annotation_audit_log FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM business_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- render_jobs policies (internal use, restrict access)
CREATE POLICY "Service role only for render_jobs"
  ON public.render_jobs FOR ALL
  USING (false);

-- =============================================
-- Triggers
-- =============================================

-- Auto-update updated_at for media_annotations
CREATE TRIGGER update_media_annotations_updated_at
  BEFORE UPDATE ON public.media_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-update updated_at for before_after_comparisons
CREATE TRIGGER update_before_after_comparisons_updated_at
  BEFORE UPDATE ON public.before_after_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update job comparison stats
CREATE OR REPLACE FUNCTION public.update_job_comparison_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_count INTEGER;
BEGIN
  -- Get the job_id from the affected row
  v_job_id := COALESCE(NEW.job_id, OLD.job_id);
  
  -- Count active comparisons for this job
  SELECT COUNT(*) INTO v_count
  FROM before_after_comparisons
  WHERE job_id = v_job_id AND deleted_at IS NULL;
  
  -- Update job stats
  UPDATE jobs
  SET comparison_count = v_count,
      has_before_after = (v_count > 0),
      updated_at = now()
  WHERE id = v_job_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_job_comparison_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.before_after_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_comparison_stats();

-- Enable realtime for annotations and comparisons
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_annotations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.before_after_comparisons;
ALTER PUBLICATION supabase_realtime ADD TABLE public.annotation_locks;