
-- =============================================
-- CUSTOMER PORTAL SCHEMA - Phase 1
-- =============================================

-- 1. customer_accounts - Account-level identity (one email can access multiple businesses)
CREATE TABLE public.customer_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  auth_method TEXT NOT NULL DEFAULT 'magic_link' CHECK (auth_method IN ('magic_link', 'password', 'both')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count INTEGER NOT NULL DEFAULT 0,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. customer_account_links - Links accounts to customers across businesses
CREATE TABLE public.customer_account_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_account_id, customer_id),
  UNIQUE(customer_account_id, business_id)
);

-- 3. customer_portal_sessions - Session management
CREATE TABLE public.customer_portal_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  active_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  active_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. customer_portal_invites - Portal invitations
CREATE TABLE public.customer_portal_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. customer_payment_methods - Saved Stripe cards
CREATE TABLE public.customer_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_account_id UUID NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_account_id, stripe_payment_method_id)
);

-- 6. customer_service_requests - Customer-initiated requests
CREATE TABLE public.customer_service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  service_type TEXT,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),
  preferred_dates JSONB DEFAULT '[]'::jsonb,
  preferred_times JSONB DEFAULT '[]'::jsonb,
  photo_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'converted', 'declined')),
  converted_to_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  converted_to_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. customer_feedback - Customer ratings
CREATE TABLE public.customer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  technician_rating INTEGER CHECK (technician_rating >= 1 AND technician_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  comment TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. portal_settings - Per-business portal config
CREATE TABLE public.portal_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  welcome_message TEXT,
  -- Feature toggles
  allow_service_requests BOOLEAN NOT NULL DEFAULT true,
  allow_quote_approval BOOLEAN NOT NULL DEFAULT true,
  allow_invoice_payment BOOLEAN NOT NULL DEFAULT true,
  allow_reschedule_requests BOOLEAN NOT NULL DEFAULT true,
  allow_feedback BOOLEAN NOT NULL DEFAULT true,
  show_technician_info BOOLEAN NOT NULL DEFAULT true,
  show_job_eta BOOLEAN NOT NULL DEFAULT true,
  -- Session settings
  session_duration_hours INTEGER NOT NULL DEFAULT 168, -- 7 days
  magic_link_expiry_minutes INTEGER NOT NULL DEFAULT 30,
  require_password_after_first_login BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. portal_activity_log - Audit trail
CREATE TABLE public.portal_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_account_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.customer_portal_sessions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- EXTEND EXISTING TABLES
-- =============================================

-- Extend customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_portal_access TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_notification_prefs JSONB DEFAULT '{"email": true, "sms": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT,
  ADD COLUMN IF NOT EXISTS sms_opted_in BOOLEAN DEFAULT false;

-- Extend jobs table
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_visible_notes TEXT,
  ADD COLUMN IF NOT EXISTS customer_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS feedback_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_request_id UUID REFERENCES public.customer_service_requests(id) ON DELETE SET NULL;

-- Extend quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS change_request_notes TEXT,
  ADD COLUMN IF NOT EXISTS change_requested_at TIMESTAMPTZ;

-- Extend invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_customer_accounts_email ON public.customer_accounts(email);
CREATE INDEX IF NOT EXISTS idx_customer_account_links_account ON public.customer_account_links(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_account_links_customer ON public.customer_account_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_account_links_business ON public.customer_account_links(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_sessions_token ON public.customer_portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_customer_portal_sessions_account ON public.customer_portal_sessions(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_invites_token ON public.customer_portal_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_customer_portal_invites_customer ON public.customer_portal_invites(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_business ON public.customer_service_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_service_requests_customer ON public.customer_service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_business ON public.customer_feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_job ON public.customer_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_log_account ON public.portal_activity_log(customer_account_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_log_business ON public.portal_activity_log(business_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Validate portal session and return customer account ID
CREATE OR REPLACE FUNCTION public.validate_portal_session(session_token UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_id UUID;
BEGIN
  SELECT customer_account_id INTO account_id
  FROM public.customer_portal_sessions
  WHERE token = session_token
    AND expires_at > now()
    AND is_revoked = false;
  
  IF account_id IS NOT NULL THEN
    UPDATE public.customer_portal_sessions
    SET last_active_at = now()
    WHERE token = session_token;
  END IF;
  
  RETURN account_id;
END;
$$;

-- Get businesses for a customer account
CREATE OR REPLACE FUNCTION public.get_customer_account_businesses(account_id UUID)
RETURNS TABLE(business_id UUID, customer_id UUID, is_primary BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cal.business_id, cal.customer_id, cal.is_primary
  FROM public.customer_account_links cal
  WHERE cal.customer_account_id = account_id
    AND cal.status = 'active';
END;
$$;

-- Generate request number
CREATE OR REPLACE FUNCTION public.generate_service_request_number(bus_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(request_number, '[^0-9]', '', 'g'), '')::INTEGER), 0) + 1
  INTO next_num
  FROM public.customer_service_requests
  WHERE business_id = bus_id;
  
  result := 'SR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN result;
END;
$$;

-- Trigger to auto-generate request number
CREATE OR REPLACE FUNCTION public.set_service_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_service_request_number(NEW.business_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_set_service_request_number
  BEFORE INSERT ON public.customer_service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_request_number();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity_log ENABLE ROW LEVEL SECURITY;

-- customer_accounts policies
CREATE POLICY "Service can manage customer accounts"
  ON public.customer_accounts FOR ALL
  USING (true)
  WITH CHECK (true);

-- customer_account_links policies
CREATE POLICY "Business users can view links in their business"
  ON public.customer_account_links FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Service can manage account links"
  ON public.customer_account_links FOR ALL
  USING (true)
  WITH CHECK (true);

-- customer_portal_sessions policies
CREATE POLICY "Service can manage portal sessions"
  ON public.customer_portal_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- customer_portal_invites policies
CREATE POLICY "Business users can manage invites in their business"
  ON public.customer_portal_invites FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Anyone can view invite by token"
  ON public.customer_portal_invites FOR SELECT
  USING (invite_token IS NOT NULL);

-- customer_payment_methods policies
CREATE POLICY "Business users can view payment methods in their business"
  ON public.customer_payment_methods FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Service can manage payment methods"
  ON public.customer_payment_methods FOR ALL
  USING (true)
  WITH CHECK (true);

-- customer_service_requests policies
CREATE POLICY "Business users can manage service requests in their business"
  ON public.customer_service_requests FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Service can insert service requests"
  ON public.customer_service_requests FOR INSERT
  WITH CHECK (true);

-- customer_feedback policies
CREATE POLICY "Business users can view feedback in their business"
  ON public.customer_feedback FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Service can insert feedback"
  ON public.customer_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view public feedback"
  ON public.customer_feedback FOR SELECT
  USING (is_public = true);

-- portal_settings policies
CREATE POLICY "Business users can manage portal settings"
  ON public.portal_settings FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Anyone can view enabled portal settings"
  ON public.portal_settings FOR SELECT
  USING (is_enabled = true);

-- portal_activity_log policies
CREATE POLICY "Business users can view activity logs in their business"
  ON public.portal_activity_log FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Service can insert activity logs"
  ON public.portal_activity_log FOR INSERT
  WITH CHECK (true);

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_account_links_updated_at
  BEFORE UPDATE ON public.customer_account_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_service_requests_updated_at
  BEFORE UPDATE ON public.customer_service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portal_settings_updated_at
  BEFORE UPDATE ON public.portal_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
