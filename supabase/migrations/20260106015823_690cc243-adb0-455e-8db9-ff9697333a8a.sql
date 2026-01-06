-- =====================================================
-- Feature Spec Compliance: Full Schema Migration
-- =====================================================

-- 1. JOBS TABLE: Temporary Geofence Expansion
-- Spec: CAP-GEO-007 - expand_geofence capability
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS geofence_expanded_radius_meters INTEGER;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS geofence_expanded_until TIMESTAMPTZ;

-- Index for efficient expired expansion checks
CREATE INDEX IF NOT EXISTS idx_jobs_geofence_expanded 
ON public.jobs(geofence_expanded_until) 
WHERE geofence_expanded_until IS NOT NULL;

-- 2. CLOCK_EVENTS TABLE: Missing fields from spec
-- Spec: override_approved_by, override_approved_at for approval workflow
ALTER TABLE public.clock_events ADD COLUMN IF NOT EXISTS override_approved_by UUID;
ALTER TABLE public.clock_events ADD COLUMN IF NOT EXISTS override_approved_at TIMESTAMPTZ;

-- Additional indexes from spec for query performance
CREATE INDEX IF NOT EXISTS idx_clock_events_job_recorded 
ON public.clock_events(job_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_clock_events_user_recorded 
ON public.clock_events(user_id, recorded_at DESC);

-- Use recorded_at directly instead of casting to date (non-immutable)
CREATE INDEX IF NOT EXISTS idx_clock_events_business_recorded 
ON public.clock_events(business_id, recorded_at DESC);

-- 3. UPDATE validate_geofence FUNCTION
-- Now checks for temporary geofence expansion first
CREATE OR REPLACE FUNCTION public.validate_geofence(
  p_job_id uuid, 
  p_worker_lat double precision, 
  p_worker_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_job RECORD;
  v_business RECORD;
  v_distance INTEGER;
  v_radius INTEGER;
  v_enforcement TEXT;
  v_within_geofence BOOLEAN;
  v_is_expanded BOOLEAN := false;
  v_expanded_until TIMESTAMPTZ := NULL;
BEGIN
  -- Get job with location
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF v_job IS NULL THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;
  
  -- Check if job has coordinates
  IF v_job.latitude IS NULL OR v_job.longitude IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'within_geofence', true,
      'is_expanded', false,
      'expanded_until', NULL,
      'message', 'Job has no location set, allowing clock-in'
    );
  END IF;
  
  -- Get business defaults
  SELECT * INTO v_business FROM businesses WHERE id = v_job.business_id;
  
  -- Calculate distance
  v_distance := calculate_distance_meters(
    p_worker_lat, p_worker_lng,
    v_job.latitude, v_job.longitude
  );
  
  -- Check for active temporary geofence expansion FIRST (Priority 1)
  IF v_job.geofence_expanded_until IS NOT NULL 
     AND v_job.geofence_expanded_until > NOW() 
     AND v_job.geofence_expanded_radius_meters IS NOT NULL THEN
    v_radius := v_job.geofence_expanded_radius_meters;
    v_is_expanded := true;
    v_expanded_until := v_job.geofence_expanded_until;
  ELSE
    -- Get effective radius: job override > business default > 150m
    v_radius := COALESCE(v_job.geofence_radius_meters, v_business.default_geofence_radius_meters, 150);
  END IF;
  
  -- Get effective enforcement mode
  v_enforcement := COALESCE(v_job.geofence_enforcement, v_business.geofence_enforcement_mode, 'warn');
  
  -- Check if within geofence
  v_within_geofence := v_distance <= v_radius;
  
  RETURN jsonb_build_object(
    'allowed', v_enforcement = 'off' OR v_within_geofence OR v_enforcement = 'warn',
    'within_geofence', v_within_geofence,
    'distance_meters', v_distance,
    'geofence_radius_meters', v_radius,
    'enforcement_mode', v_enforcement,
    'can_override', v_business.geofence_allow_override,
    'override_requires_reason', v_business.geofence_override_requires_reason,
    'override_requires_photo', v_business.geofence_override_requires_photo,
    'job_latitude', v_job.latitude,
    'job_longitude', v_job.longitude,
    'is_expanded', v_is_expanded,
    'expanded_until', v_expanded_until
  );
END;
$function$;

-- 4. CREATE update_worker_status FUNCTION
-- Spec: Required database function for updating worker status based on location
CREATE OR REPLACE FUNCTION public.update_worker_status(
  p_user_id UUID,
  p_business_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_accuracy_meters INTEGER DEFAULT NULL
)
RETURNS public.worker_statuses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_job RECORD;
  v_distance INTEGER;
  v_new_status TEXT;
  v_result worker_statuses;
  v_on_site_threshold INTEGER := 100; -- meters
BEGIN
  -- Find current clocked-in job for this user
  SELECT j.* INTO v_current_job
  FROM jobs j
  WHERE j.assigned_to = p_user_id
    AND j.is_clocked_in = true
    AND j.business_id = p_business_id
  LIMIT 1;
  
  IF v_current_job IS NOT NULL AND v_current_job.latitude IS NOT NULL AND v_current_job.longitude IS NOT NULL THEN
    -- Calculate distance to job site
    v_distance := calculate_distance_meters(p_lat, p_lng, v_current_job.latitude, v_current_job.longitude);
    
    -- Determine status based on distance
    IF v_distance <= v_on_site_threshold THEN
      v_new_status := 'on_site';
    ELSE
      v_new_status := 'traveling';
    END IF;
  ELSIF v_current_job IS NOT NULL THEN
    -- Job exists but no location, assume on_site
    v_new_status := 'on_site';
  ELSE
    -- No active job
    v_new_status := 'off_duty';
  END IF;
  
  -- Upsert worker status
  INSERT INTO worker_statuses (
    user_id,
    business_id,
    current_status,
    current_job_id,
    current_location_lat,
    current_location_lng,
    last_location_at,
    status_since,
    updated_at
  )
  VALUES (
    p_user_id,
    p_business_id,
    v_new_status,
    v_current_job.id,
    p_lat,
    p_lng,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    current_status = CASE 
      WHEN worker_statuses.current_status != v_new_status THEN v_new_status 
      ELSE worker_statuses.current_status 
    END,
    current_job_id = v_current_job.id,
    current_location_lat = p_lat,
    current_location_lng = p_lng,
    last_location_at = NOW(),
    status_since = CASE 
      WHEN worker_statuses.current_status != v_new_status THEN NOW() 
      ELSE worker_statuses.status_since 
    END,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  -- Also insert into worker_locations for history
  INSERT INTO worker_locations (
    user_id,
    business_id,
    latitude,
    longitude,
    accuracy_meters,
    recorded_at
  ) VALUES (
    p_user_id,
    p_business_id,
    p_lat,
    p_lng,
    p_accuracy_meters,
    NOW()
  );
  
  RETURN v_result;
END;
$function$;