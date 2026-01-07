-- =============================================
-- REVIEW & REPUTATION MANAGEMENT - DATABASE SCHEMA
-- =============================================

-- 1. Create review_configs table (business-level automation settings)
CREATE TABLE public.review_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Automation settings
  auto_request_enabled BOOLEAN NOT NULL DEFAULT false,
  request_channel TEXT NOT NULL DEFAULT 'email' CHECK (request_channel IN ('email', 'sms', 'both')),
  delay_minutes INTEGER NOT NULL DEFAULT 120,
  minimum_job_value NUMERIC(10,2) DEFAULT NULL,
  cooldown_days INTEGER NOT NULL DEFAULT 30,
  
  -- Send window
  send_window_start TIME NOT NULL DEFAULT '09:00:00',
  send_window_end TIME NOT NULL DEFAULT '20:00:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  send_on_weekends BOOLEAN NOT NULL DEFAULT false,
  
  -- Platform connections
  google_place_id TEXT,
  google_review_url TEXT,
  yelp_business_id TEXT,
  yelp_review_url TEXT,
  facebook_page_id TEXT,
  facebook_review_url TEXT,
  
  -- Thresholds
  promoter_threshold INTEGER NOT NULL DEFAULT 4 CHECK (promoter_threshold BETWEEN 1 AND 5),
  detractor_threshold INTEGER NOT NULL DEFAULT 3 CHECK (detractor_threshold BETWEEN 1 AND 5),
  
  -- SMS settings
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_sender_name TEXT,
  
  -- Reminder settings
  reminder_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_delay_hours INTEGER NOT NULL DEFAULT 72,
  max_reminders INTEGER NOT NULL DEFAULT 2,
  
  -- Stats (denormalized for quick display)
  total_requests_sent INTEGER NOT NULL DEFAULT 0,
  total_reviews_received INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(2,1) DEFAULT NULL,
  response_rate NUMERIC(5,2) DEFAULT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create review_requests table (individual request tracking)
CREATE TABLE public.review_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Scheduling
  scheduled_send_at TIMESTAMPTZ NOT NULL,
  actual_sent_at TIMESTAMPTZ,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'delivered', 'opened', 'clicked', 'completed', 'skipped', 'failed', 'cancelled')),
  
  -- Delivery tracking
  message_id TEXT,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  -- Token for public page
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  
  -- Reminders
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  
  -- Result
  review_id UUID,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create reviews table (collected reviews with routing)
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  review_request_id UUID REFERENCES public.review_requests(id) ON DELETE SET NULL,
  assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Rating
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
  
  -- Content
  feedback_text TEXT,
  feedback_sentiment TEXT CHECK (feedback_sentiment IN ('positive', 'neutral', 'negative')),
  feedback_key_phrases JSONB DEFAULT '[]'::jsonb,
  
  -- Breakdown ratings (optional)
  technician_rating INTEGER CHECK (technician_rating BETWEEN 1 AND 5),
  timeliness_rating INTEGER CHECK (timeliness_rating BETWEEN 1 AND 5),
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
  value_rating INTEGER CHECK (value_rating BETWEEN 1 AND 5),
  
  -- Routing
  is_public BOOLEAN NOT NULL DEFAULT false,
  platform TEXT CHECK (platform IN ('google', 'yelp', 'facebook', 'internal')),
  external_review_id TEXT,
  external_review_url TEXT,
  
  -- Response
  response_text TEXT,
  response_suggested TEXT,
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Display
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  display_approved BOOLEAN NOT NULL DEFAULT false,
  
  -- Source
  source TEXT NOT NULL DEFAULT 'request' CHECK (source IN ('request', 'portal', 'import', 'aggregated')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create external_reviews table (aggregated from platforms)
CREATE TABLE public.external_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'yelp', 'facebook')),
  external_id TEXT NOT NULL,
  
  -- Review content
  author_name TEXT,
  author_image_url TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  review_url TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL,
  
  -- Response
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  is_responded BOOLEAN NOT NULL DEFAULT false,
  
  -- Analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint for deduplication
  UNIQUE(business_id, platform, external_id)
);

-- 5. Create technician_review_stats table (denormalized leaderboard)
CREATE TABLE public.technician_review_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Stats
  total_reviews INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(2,1) DEFAULT NULL,
  five_star_count INTEGER NOT NULL DEFAULT 0,
  four_star_count INTEGER NOT NULL DEFAULT 0,
  three_star_count INTEGER NOT NULL DEFAULT 0,
  two_star_count INTEGER NOT NULL DEFAULT 0,
  one_star_count INTEGER NOT NULL DEFAULT 0,
  
  -- Additional metrics
  mentions_count INTEGER NOT NULL DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  trend_7d NUMERIC(3,2) DEFAULT NULL,
  rank_in_business INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(business_id, profile_id)
);

-- 6. Extend customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS review_opt_out BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS review_opt_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_review_request_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_reviews_given INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_rating_given NUMERIC(2,1),
ADD COLUMN IF NOT EXISTS preferred_review_channel TEXT DEFAULT 'email';

-- 7. Extend jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS review_request_id UUID REFERENCES public.review_requests(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMPTZ;

-- Add FK from review_requests.review_id to reviews
ALTER TABLE public.review_requests
ADD CONSTRAINT fk_review_requests_review 
FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE SET NULL;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.review_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_review_stats ENABLE ROW LEVEL SECURITY;

-- review_configs policies
CREATE POLICY "Users can view review configs for their business"
ON public.review_configs FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert review configs for their business"
ON public.review_configs FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update review configs for their business"
ON public.review_configs FOR UPDATE
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can delete review configs for their business"
ON public.review_configs FOR DELETE
USING (user_belongs_to_business(business_id));

-- review_requests policies
CREATE POLICY "Users can view review requests for their business"
ON public.review_requests FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert review requests for their business"
ON public.review_requests FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update review requests for their business"
ON public.review_requests FOR UPDATE
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can delete review requests for their business"
ON public.review_requests FOR DELETE
USING (user_belongs_to_business(business_id));

-- reviews policies
CREATE POLICY "Users can view reviews for their business"
ON public.reviews FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert reviews for their business"
ON public.reviews FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update reviews for their business"
ON public.reviews FOR UPDATE
USING (user_belongs_to_business(business_id));

-- external_reviews policies
CREATE POLICY "Users can view external reviews for their business"
ON public.external_reviews FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert external reviews for their business"
ON public.external_reviews FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update external reviews for their business"
ON public.external_reviews FOR UPDATE
USING (user_belongs_to_business(business_id));

-- technician_review_stats policies
CREATE POLICY "Users can view technician stats for their business"
ON public.technician_review_stats FOR SELECT
USING (user_belongs_to_business(business_id));

-- =============================================
-- INDEXES
-- =============================================

-- review_requests indexes
CREATE INDEX idx_review_requests_scheduled 
ON public.review_requests(scheduled_send_at) 
WHERE status = 'scheduled';

CREATE INDEX idx_review_requests_business_status 
ON public.review_requests(business_id, status);

CREATE INDEX idx_review_requests_token 
ON public.review_requests(token);

CREATE INDEX idx_review_requests_next_reminder 
ON public.review_requests(next_reminder_at) 
WHERE status = 'sent' AND next_reminder_at IS NOT NULL;

-- reviews indexes
CREATE INDEX idx_reviews_business_rating 
ON public.reviews(business_id, rating);

CREATE INDEX idx_reviews_technician 
ON public.reviews(assigned_technician_id, rating) 
WHERE assigned_technician_id IS NOT NULL;

CREATE INDEX idx_reviews_business_created 
ON public.reviews(business_id, created_at DESC);

-- external_reviews indexes
CREATE INDEX idx_external_reviews_platform 
ON public.external_reviews(business_id, platform);

CREATE INDEX idx_external_reviews_unresponded 
ON public.external_reviews(business_id) 
WHERE is_responded = false;

-- technician_review_stats indexes
CREATE INDEX idx_technician_stats_ranking 
ON public.technician_review_stats(business_id, rank_in_business);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_review_configs_updated_at
BEFORE UPDATE ON public.review_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_review_requests_updated_at
BEFORE UPDATE ON public.review_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_reviews_updated_at
BEFORE UPDATE ON public.external_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_technician_review_stats_updated_at
BEFORE UPDATE ON public.technician_review_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.external_reviews;