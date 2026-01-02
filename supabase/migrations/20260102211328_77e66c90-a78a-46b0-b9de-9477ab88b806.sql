-- =============================================
-- PHASE 1A: ServiceGrid Database Schema Setup
-- =============================================

-- 1. Create role enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'technician', 'viewer');

-- 2. Create user_roles table (security best practice - separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function for role checking (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Create businesses table (multi-tenant core)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  industry TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT DEFAULT 'US',
  timezone TEXT DEFAULT 'America/New_York',
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- 5. Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  job_title TEXT,
  is_onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  lead_score INTEGER DEFAULT 0,
  lead_status TEXT DEFAULT 'new',
  preferred_contact_method TEXT DEFAULT 'email',
  preferred_schedule_days TEXT[] DEFAULT '{}',
  preferred_schedule_time TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 7. Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  quote_number TEXT NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'draft',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  valid_until DATE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  signature_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- 8. Create quote_items table
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- 9. Create jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled',
  priority TEXT DEFAULT 'normal',
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 10. Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  due_date DATE,
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 11. Create invoice_items table
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- 12. Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 13. Create email_queue table for automation
CREATE TABLE public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT,
  related_id UUID,
  related_type TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- 14. Create automation_rules table
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- 15. Create lead_scoring_rules table
CREATE TABLE public.lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL,
  condition_value TEXT,
  score_adjustment INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.lead_scoring_rules ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get user's business_id
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Function to check if user belongs to a business
CREATE OR REPLACE FUNCTION public.user_belongs_to_business(_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND business_id = _business_id
  )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners can manage roles in their business"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p1.business_id = p2.business_id
      WHERE p1.id = auth.uid()
        AND p2.id = user_id
        AND public.has_role(auth.uid(), 'owner')
    )
  );

-- Businesses policies
CREATE POLICY "Users can view their own business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(id));

CREATE POLICY "Owners can update their business"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_business(id) AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Authenticated users can create businesses"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Users can view profiles in their business"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    business_id IS NULL OR public.user_belongs_to_business(business_id) OR id = auth.uid()
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Customers policies
CREATE POLICY "Users can view customers in their business"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage customers in their business"
  ON public.customers FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Quotes policies
CREATE POLICY "Users can view quotes in their business"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage quotes in their business"
  ON public.quotes FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Quote items policies
CREATE POLICY "Users can view quote items for their quotes"
  ON public.quote_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q 
      WHERE q.id = quote_id AND public.user_belongs_to_business(q.business_id)
    )
  );

CREATE POLICY "Users can manage quote items for their quotes"
  ON public.quote_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q 
      WHERE q.id = quote_id AND public.user_belongs_to_business(q.business_id)
    )
  );

-- Jobs policies
CREATE POLICY "Users can view jobs in their business"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage jobs in their business"
  ON public.jobs FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Invoices policies
CREATE POLICY "Users can view invoices in their business"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage invoices in their business"
  ON public.invoices FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Invoice items policies
CREATE POLICY "Users can view invoice items for their invoices"
  ON public.invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i 
      WHERE i.id = invoice_id AND public.user_belongs_to_business(i.business_id)
    )
  );

CREATE POLICY "Users can manage invoice items for their invoices"
  ON public.invoice_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i 
      WHERE i.id = invoice_id AND public.user_belongs_to_business(i.business_id)
    )
  );

-- Payments policies
CREATE POLICY "Users can view payments in their business"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage payments in their business"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Email queue policies
CREATE POLICY "Users can view emails in their business"
  ON public.email_queue FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Users can manage emails in their business"
  ON public.email_queue FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

-- Automation rules policies
CREATE POLICY "Users can view automation rules in their business"
  ON public.automation_rules FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Owners can manage automation rules"
  ON public.automation_rules FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id) AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

-- Lead scoring rules policies
CREATE POLICY "Users can view lead scoring rules in their business"
  ON public.lead_scoring_rules FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_business(business_id));

CREATE POLICY "Owners can manage lead scoring rules"
  ON public.lead_scoring_rules FOR ALL
  TO authenticated
  USING (public.user_belongs_to_business(business_id) AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PROFILE CREATION TRIGGER
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();