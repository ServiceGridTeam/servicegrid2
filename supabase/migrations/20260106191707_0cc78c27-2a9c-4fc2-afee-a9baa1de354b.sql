-- Create portal_access_audit table for compliance tracking
CREATE TABLE portal_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES customer_accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_details JSONB DEFAULT '{}'::jsonb,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_portal_audit_customer ON portal_access_audit(customer_id, created_at DESC);
CREATE INDEX idx_portal_audit_business ON portal_access_audit(business_id, created_at DESC);
CREATE INDEX idx_portal_audit_event_type ON portal_access_audit(business_id, event_type, created_at DESC);

-- RLS policies
ALTER TABLE portal_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view portal audit" ON portal_access_audit
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM business_memberships WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Add reminder columns to customer_portal_invites
ALTER TABLE customer_portal_invites
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Add portal notification preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS email_portal_first_login BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_portal_login BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inapp_portal_activity BOOLEAN DEFAULT true;