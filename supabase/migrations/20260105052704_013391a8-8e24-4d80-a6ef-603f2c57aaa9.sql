-- Phase 5: Route Planning Caching and Worker Location Tables

-- 1. Create worker_locations table for real-time GPS tracking
CREATE TABLE public.worker_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters INTEGER,
  heading INTEGER,
  speed_mps DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient time-series queries
CREATE INDEX idx_worker_loc_user_time ON public.worker_locations(user_id, recorded_at DESC);
CREATE INDEX idx_worker_loc_business ON public.worker_locations(business_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE public.worker_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view worker locations in their business"
  ON public.worker_locations FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert their own location"
  ON public.worker_locations FOR INSERT
  WITH CHECK (user_belongs_to_business(business_id) AND user_id = auth.uid());

CREATE POLICY "Admins can manage all locations"
  ON public.worker_locations FOR ALL
  USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 2. Create route_directions_cache table for API cost optimization
CREATE TABLE public.route_directions_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_hash TEXT UNIQUE NOT NULL,
  waypoints JSONB NOT NULL,
  total_distance_meters INTEGER,
  total_duration_seconds INTEGER,
  legs JSONB,
  overview_polyline TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_route_cache_hash ON public.route_directions_cache(route_hash);
CREATE INDEX idx_route_cache_expires ON public.route_directions_cache(expires_at);

-- Enable RLS (public read for caching efficiency)
ALTER TABLE public.route_directions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read route cache"
  ON public.route_directions_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert route cache"
  ON public.route_directions_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Create travel_time_cache table for point-to-point travel estimates
CREATE TABLE public.travel_time_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_hash TEXT NOT NULL,
  destination_hash TEXT NOT NULL,
  travel_time_seconds INTEGER NOT NULL,
  distance_meters INTEGER,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE(origin_hash, destination_hash)
);

CREATE INDEX idx_travel_cache_lookup ON public.travel_time_cache(origin_hash, destination_hash);
CREATE INDEX idx_travel_cache_expires ON public.travel_time_cache(expires_at);

-- Enable RLS
ALTER TABLE public.travel_time_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read travel cache"
  ON public.travel_time_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert travel cache"
  ON public.travel_time_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Add customer scheduling preferences
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS preferred_time_window JSONB,
ADD COLUMN IF NOT EXISTS scheduling_notes TEXT;