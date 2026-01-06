-- ============================================
-- EMAIL MARKETING & SEQUENCES SCHEMA
-- Phase 1: Foundation Database Schema
-- ============================================

-- ============================================
-- 1. EMAIL TEMPLATES TABLE
-- ============================================
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  category TEXT DEFAULT 'general',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage email templates in their business"
  ON public.email_templates FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view email templates in their business"
  ON public.email_templates FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_email_templates_business ON public.email_templates(business_id);
CREATE INDEX idx_email_templates_category ON public.email_templates(business_id, category);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. EMAIL SEQUENCES TABLE
-- ============================================
CREATE TABLE public.email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  enrollment_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage email sequences in their business"
  ON public.email_sequences FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view email sequences in their business"
  ON public.email_sequences FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_email_sequences_business ON public.email_sequences(business_id);
CREATE INDEX idx_email_sequences_status ON public.email_sequences(business_id, status);
CREATE INDEX idx_email_sequences_trigger ON public.email_sequences(business_id, trigger_type);

-- Trigger for updated_at
CREATE TRIGGER update_email_sequences_updated_at
  BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3. SEQUENCE STEPS TABLE
-- ============================================
CREATE TABLE public.sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  subject_override TEXT,
  body_override_html TEXT,
  send_conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage sequence steps in their business"
  ON public.sequence_steps FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view sequence steps in their business"
  ON public.sequence_steps FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_sequence_steps_sequence ON public.sequence_steps(sequence_id);
CREATE INDEX idx_sequence_steps_order ON public.sequence_steps(sequence_id, step_order);
CREATE UNIQUE INDEX idx_sequence_steps_unique_order ON public.sequence_steps(sequence_id, step_order);

-- Trigger for updated_at
CREATE TRIGGER update_sequence_steps_updated_at
  BEFORE UPDATE ON public.sequence_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. SEQUENCE ENROLLMENTS TABLE
-- ============================================
CREATE TABLE public.sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  next_email_at TIMESTAMPTZ,
  exit_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage sequence enrollments in their business"
  ON public.sequence_enrollments FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view sequence enrollments in their business"
  ON public.sequence_enrollments FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_sequence_enrollments_sequence ON public.sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_customer ON public.sequence_enrollments(customer_id);
CREATE INDEX idx_sequence_enrollments_status ON public.sequence_enrollments(business_id, status);
CREATE INDEX idx_sequence_enrollments_next_email ON public.sequence_enrollments(next_email_at) WHERE status = 'active';
CREATE UNIQUE INDEX idx_sequence_enrollments_unique ON public.sequence_enrollments(sequence_id, customer_id) WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER update_sequence_enrollments_updated_at
  BEFORE UPDATE ON public.sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 5. CAMPAIGNS TABLE
-- ============================================
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  segment_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  complained_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage campaigns in their business"
  ON public.campaigns FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view campaigns in their business"
  ON public.campaigns FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_campaigns_business ON public.campaigns(business_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(business_id, status);
CREATE INDEX idx_campaigns_scheduled ON public.campaigns(scheduled_at) WHERE status = 'scheduled';

-- Trigger for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. EMAIL SENDS TABLE
-- ============================================
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES public.email_sequences(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL DEFAULT 'campaign',
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  clicked_links JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view email sends in their business"
  ON public.email_sends FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert email sends in their business"
  ON public.email_sends FOR INSERT
  WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Service can insert email sends"
  ON public.email_sends FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update email sends"
  ON public.email_sends FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX idx_email_sends_business ON public.email_sends(business_id);
CREATE INDEX idx_email_sends_customer ON public.email_sends(customer_id);
CREATE INDEX idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX idx_email_sends_sequence ON public.email_sends(sequence_id);
CREATE INDEX idx_email_sends_enrollment ON public.email_sends(enrollment_id);
CREATE INDEX idx_email_sends_resend ON public.email_sends(resend_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(business_id, status);
CREATE INDEX idx_email_sends_type ON public.email_sends(business_id, email_type);
CREATE INDEX idx_email_sends_created ON public.email_sends(business_id, created_at DESC);

-- ============================================
-- 7. EMAIL PREFERENCES TABLE
-- ============================================
CREATE TABLE public.email_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  preference_token UUID NOT NULL DEFAULT gen_random_uuid(),
  subscribed_marketing BOOLEAN DEFAULT true,
  subscribed_sequences BOOLEAN DEFAULT true,
  subscribed_transactional BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  resubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage email preferences in their business"
  ON public.email_preferences FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view email preferences in their business"
  ON public.email_preferences FOR SELECT
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Anyone can view preferences via token"
  ON public.email_preferences FOR SELECT
  USING (preference_token IS NOT NULL);

CREATE POLICY "Anyone can update preferences via token"
  ON public.email_preferences FOR UPDATE
  USING (preference_token IS NOT NULL);

-- Indexes
CREATE INDEX idx_email_preferences_business ON public.email_preferences(business_id);
CREATE INDEX idx_email_preferences_customer ON public.email_preferences(customer_id);
CREATE UNIQUE INDEX idx_email_preferences_unique ON public.email_preferences(business_id, customer_id);
CREATE UNIQUE INDEX idx_email_preferences_token ON public.email_preferences(preference_token);

-- Trigger for updated_at
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. AUDIENCE SEGMENTS TABLE
-- ============================================
CREATE TABLE public.audience_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ,
  is_dynamic BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage audience segments in their business"
  ON public.audience_segments FOR ALL
  USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can view audience segments in their business"
  ON public.audience_segments FOR SELECT
  USING (user_belongs_to_business(business_id));

-- Indexes
CREATE INDEX idx_audience_segments_business ON public.audience_segments(business_id);

-- Trigger for updated_at
CREATE TRIGGER update_audience_segments_updated_at
  BEFORE UPDATE ON public.audience_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 9. EXTEND CUSTOMERS TABLE
-- ============================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'subscribed',
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_email_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_engagement_score INTEGER DEFAULT 50;

-- Add index for email marketing queries
CREATE INDEX IF NOT EXISTS idx_customers_email_status ON public.customers(business_id, email_status);
CREATE INDEX IF NOT EXISTS idx_customers_email_engagement ON public.customers(business_id, email_engagement_score);

-- ============================================
-- 10. ADD SEGMENT FOREIGN KEY TO CAMPAIGNS
-- ============================================
ALTER TABLE public.campaigns
  ADD CONSTRAINT fk_campaigns_segment
  FOREIGN KEY (segment_id) REFERENCES public.audience_segments(id) ON DELETE SET NULL;