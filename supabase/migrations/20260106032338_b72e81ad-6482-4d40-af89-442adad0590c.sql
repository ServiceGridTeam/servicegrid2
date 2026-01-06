-- =====================================================
-- Phone Integration Phase 1: Foundation Tables
-- =====================================================

-- Table 1: phone_integrations
-- Stores API key credentials and permission settings per business
CREATE TABLE public.phone_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  
  -- API Key (hashed for security)
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  
  -- Permissions
  permissions jsonb NOT NULL DEFAULT '{
    "lookup_customer": true,
    "read_jobs": true,
    "create_requests": true,
    "modify_jobs": false,
    "read_pricing": false,
    "read_technician_eta": true
  }'::jsonb,
  
  -- Status and Rate Limiting
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  request_count integer DEFAULT 0,
  request_count_reset_at timestamptz DEFAULT now(),
  
  -- Metadata
  name text DEFAULT 'SG Phone',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id),
  
  -- Constraints
  CONSTRAINT phone_integrations_business_unique UNIQUE (business_id),
  CONSTRAINT phone_integrations_status_check CHECK (status IN ('active', 'revoked'))
);

-- Index for API key lookup (only active keys)
CREATE INDEX idx_phone_integrations_hash ON public.phone_integrations(api_key_hash) WHERE status = 'active';
CREATE INDEX idx_phone_integrations_business ON public.phone_integrations(business_id);

-- Table 2: job_requests
-- Queue for incoming job requests from phone, web, or walk-ins
CREATE TABLE public.job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Source Tracking
  source text NOT NULL,
  source_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Request Data
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_type text,
  description text,
  address jsonb,
  urgency text DEFAULT 'routine',
  preferred_date date,
  preferred_time text,
  
  -- Customer Info (for new customers)
  customer_name text,
  customer_phone text,
  customer_email text,
  
  -- Processing
  status text NOT NULL DEFAULT 'pending',
  priority_score integer DEFAULT 50,
  converted_to_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT job_requests_status_check CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'converted')),
  CONSTRAINT job_requests_urgency_check CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),
  CONSTRAINT job_requests_source_check CHECK (source IN ('phone', 'web', 'walk-in'))
);

-- Indexes for job_requests
CREATE INDEX idx_job_requests_business_status ON public.job_requests(business_id, status);
CREATE INDEX idx_job_requests_priority ON public.job_requests(business_id, priority_score DESC) WHERE status = 'pending';
CREATE INDEX idx_job_requests_customer ON public.job_requests(customer_id) WHERE customer_id IS NOT NULL;

-- Table 3: job_modification_requests
-- Queue for reschedule/cancel requests from customers
CREATE TABLE public.job_modification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  
  -- Modification Details
  modification_type text NOT NULL,
  requested_date date,
  time_preference text,
  reason text,
  
  -- Source Tracking
  source text NOT NULL,
  source_metadata jsonb DEFAULT '{}'::jsonb,
  
  -- Processing
  status text NOT NULL DEFAULT 'pending',
  processed_by uuid REFERENCES public.profiles(id),
  processed_at timestamptz,
  new_scheduled_start timestamptz,
  new_scheduled_end timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT modification_type_check CHECK (modification_type IN ('reschedule', 'cancel')),
  CONSTRAINT modification_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

-- Indexes for job_modification_requests
CREATE INDEX idx_modification_requests_business ON public.job_modification_requests(business_id, status);
CREATE INDEX idx_modification_requests_job ON public.job_modification_requests(job_id);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.phone_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_modification_requests ENABLE ROW LEVEL SECURITY;

-- phone_integrations policies
CREATE POLICY "Users can view phone integrations in their business"
  ON public.phone_integrations FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Admins can manage phone integrations"
  ON public.phone_integrations FOR ALL
  USING (user_belongs_to_business(business_id) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- job_requests policies
CREATE POLICY "Users can view job requests in their business"
  ON public.job_requests FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage job requests in their business"
  ON public.job_requests FOR ALL
  USING (user_belongs_to_business(business_id));

-- job_modification_requests policies
CREATE POLICY "Users can view modification requests in their business"
  ON public.job_modification_requests FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage modification requests in their business"
  ON public.job_modification_requests FOR ALL
  USING (user_belongs_to_business(business_id));

-- =====================================================
-- Enable Realtime for job_requests
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_requests;

-- =====================================================
-- Updated_at trigger for new tables
-- =====================================================
CREATE TRIGGER update_job_requests_updated_at
  BEFORE UPDATE ON public.job_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_modification_requests_updated_at
  BEFORE UPDATE ON public.job_modification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();