-- Phase 1: Route Planning Foundation Schema

-- 1. Extend jobs table with route planning fields
ALTER TABLE jobs
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN estimated_duration_minutes INTEGER DEFAULT 60,
ADD COLUMN route_plan_id UUID,
ADD COLUMN route_sequence INTEGER,
ADD COLUMN estimated_arrival TIMESTAMPTZ,
ADD COLUMN actual_arrival TIMESTAMPTZ,
ADD COLUMN drive_time_from_previous INTEGER,
ADD COLUMN auto_assigned BOOLEAN DEFAULT FALSE,
ADD COLUMN assignment_reasoning TEXT;

-- 2. Create daily_route_plans table
CREATE TABLE daily_route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  job_ids UUID[] NOT NULL DEFAULT '{}',
  optimized_sequence INTEGER[],
  total_distance_meters INTEGER,
  total_duration_seconds INTEGER,
  total_job_time_minutes INTEGER,
  start_location JSONB,
  end_location JSONB,
  overview_polyline TEXT,
  legs JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  optimization_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, user_id, route_date)
);

-- 3. Create team_availability table
CREATE TABLE team_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL DEFAULT '08:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_of_week)
);

-- 4. Create time_off_requests table
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create geocode_cache table
CREATE TABLE geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  place_id TEXT,
  formatted_address TEXT,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Extend profiles table with worker settings
ALTER TABLE profiles
ADD COLUMN home_address TEXT,
ADD COLUMN home_latitude DOUBLE PRECISION,
ADD COLUMN home_longitude DOUBLE PRECISION,
ADD COLUMN max_daily_jobs INTEGER DEFAULT 8,
ADD COLUMN max_daily_hours INTEGER DEFAULT 8,
ADD COLUMN skill_tags TEXT[];

-- 7. Extend customers table with geocoding and preferences
ALTER TABLE customers
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN preferred_days JSONB,
ADD COLUMN avoid_days JSONB;

-- 8. Add foreign key for route_plan_id on jobs
ALTER TABLE jobs
ADD CONSTRAINT fk_jobs_route_plan 
FOREIGN KEY (route_plan_id) REFERENCES daily_route_plans(id) ON DELETE SET NULL;

-- 9. Enable RLS on new tables
ALTER TABLE daily_route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies for daily_route_plans
CREATE POLICY "Users can view route plans in their business"
ON daily_route_plans FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can create route plans in their business"
ON daily_route_plans FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update route plans in their business"
ON daily_route_plans FOR UPDATE
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can delete route plans in their business"
ON daily_route_plans FOR DELETE
USING (user_belongs_to_business(business_id));

-- 11. RLS Policies for team_availability
CREATE POLICY "Users can view availability in their business"
ON team_availability FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage their own availability"
ON team_availability FOR INSERT
WITH CHECK (user_belongs_to_business(business_id) AND user_id = auth.uid());

CREATE POLICY "Users can update their own availability"
ON team_availability FOR UPDATE
USING (user_belongs_to_business(business_id) AND user_id = auth.uid());

CREATE POLICY "Admins can manage all availability"
ON team_availability FOR ALL
USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 12. RLS Policies for time_off_requests
CREATE POLICY "Users can view time off requests in their business"
ON time_off_requests FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can create their own time off requests"
ON time_off_requests FOR INSERT
WITH CHECK (user_belongs_to_business(business_id) AND user_id = auth.uid());

CREATE POLICY "Users can update their own pending requests"
ON time_off_requests FOR UPDATE
USING (user_belongs_to_business(business_id) AND user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can manage all time off requests"
ON time_off_requests FOR ALL
USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- 13. RLS Policies for geocode_cache (shared across businesses)
CREATE POLICY "Anyone can read geocode cache"
ON geocode_cache FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert geocode cache"
ON geocode_cache FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- 14. Create indexes for performance
CREATE INDEX idx_route_plans_user_date ON daily_route_plans(user_id, route_date);
CREATE INDEX idx_route_plans_business_date ON daily_route_plans(business_id, route_date);
CREATE INDEX idx_jobs_route_plan ON jobs(route_plan_id) WHERE route_plan_id IS NOT NULL;
CREATE INDEX idx_jobs_lat_lng ON jobs(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_team_availability_user ON team_availability(user_id);
CREATE INDEX idx_time_off_user_dates ON time_off_requests(user_id, start_date, end_date);
CREATE INDEX idx_geocode_address ON geocode_cache(address);
CREATE INDEX idx_customers_lat_lng ON customers(latitude, longitude) WHERE latitude IS NOT NULL;

-- 15. Add updated_at triggers for new tables
CREATE TRIGGER update_daily_route_plans_updated_at
BEFORE UPDATE ON daily_route_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_requests_updated_at
BEFORE UPDATE ON time_off_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();