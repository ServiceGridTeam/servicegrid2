-- Enable PostGIS extension for spatial calculations
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Extend businesses table with geofence defaults
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS default_geofence_radius_meters INTEGER DEFAULT 150,
ADD COLUMN IF NOT EXISTS geofence_enforcement_mode TEXT DEFAULT 'warn',
ADD COLUMN IF NOT EXISTS geofence_allow_override BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS geofence_override_requires_reason BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS geofence_override_requires_photo BOOLEAN DEFAULT false;

-- Extend jobs table with geofence and clock fields
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER,
ADD COLUMN IF NOT EXISTS geofence_enforcement TEXT,
ADD COLUMN IF NOT EXISTS clock_in_location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_out_location_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS clock_in_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS clock_out_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS clock_in_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clock_out_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_clocked_in BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ;

-- Create clock_events table for audit log
CREATE TABLE public.clock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters INTEGER,
  location_source TEXT,
  job_latitude DOUBLE PRECISION,
  job_longitude DOUBLE PRECISION,
  distance_from_job_meters INTEGER,
  geofence_radius_meters INTEGER,
  within_geofence BOOLEAN NOT NULL,
  override_reason TEXT,
  override_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create geofence_alerts table
CREATE TABLE public.geofence_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  clock_event_id UUID NOT NULL REFERENCES public.clock_events(id) ON DELETE CASCADE,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  distance_meters INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create worker_statuses table for real-time tracking
CREATE TABLE public.worker_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  user_id UUID NOT NULL UNIQUE,
  current_status TEXT NOT NULL DEFAULT 'off_duty',
  current_job_id UUID,
  current_location_lat DOUBLE PRECISION,
  current_location_lng DOUBLE PRECISION,
  last_location_at TIMESTAMPTZ,
  clocked_in_at TIMESTAMPTZ,
  status_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clock_events
CREATE POLICY "Users can view clock events in their business"
  ON public.clock_events FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert their own clock events"
  ON public.clock_events FOR INSERT
  WITH CHECK (user_belongs_to_business(business_id) AND user_id = auth.uid());

-- RLS Policies for geofence_alerts
CREATE POLICY "Users can view alerts in their business"
  ON public.geofence_alerts FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Admins can manage alerts"
  ON public.geofence_alerts FOR ALL
  USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can insert alerts for their events"
  ON public.geofence_alerts FOR INSERT
  WITH CHECK (user_belongs_to_business(business_id));

-- RLS Policies for worker_statuses
CREATE POLICY "Users can view worker statuses in their business"
  ON public.worker_statuses FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage their own status"
  ON public.worker_statuses FOR ALL
  USING (user_belongs_to_business(business_id) AND user_id = auth.uid());

CREATE POLICY "Admins can manage all statuses"
  ON public.worker_statuses FOR ALL
  USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Enable realtime for geofence_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.geofence_alerts;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clock_events_business_id ON public.clock_events(business_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_job_id ON public.clock_events(job_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_user_id ON public.clock_events(user_id);
CREATE INDEX IF NOT EXISTS idx_geofence_alerts_business_status ON public.geofence_alerts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_worker_statuses_business_id ON public.worker_statuses(business_id);

-- Create function to calculate distance using Haversine formula (fallback if PostGIS not available)
CREATE OR REPLACE FUNCTION public.calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius_meters CONSTANT INTEGER := 6371000;
  lat1_rad DOUBLE PRECISION;
  lat2_rad DOUBLE PRECISION;
  delta_lat DOUBLE PRECISION;
  delta_lng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  lat1_rad := radians(lat1);
  lat2_rad := radians(lat2);
  delta_lat := radians(lat2 - lat1);
  delta_lng := radians(lng2 - lng1);
  
  a := sin(delta_lat / 2) * sin(delta_lat / 2) +
       cos(lat1_rad) * cos(lat2_rad) *
       sin(delta_lng / 2) * sin(delta_lng / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN (earth_radius_meters * c)::INTEGER;
END;
$$;

-- Create function to validate geofence
CREATE OR REPLACE FUNCTION public.validate_geofence(
  p_job_id UUID,
  p_worker_lat DOUBLE PRECISION,
  p_worker_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job RECORD;
  v_business RECORD;
  v_distance INTEGER;
  v_radius INTEGER;
  v_enforcement TEXT;
  v_within_geofence BOOLEAN;
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
  
  -- Get effective radius (job override > business default)
  v_radius := COALESCE(v_job.geofence_radius_meters, v_business.default_geofence_radius_meters, 150);
  
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
    'job_longitude', v_job.longitude
  );
END;
$$;