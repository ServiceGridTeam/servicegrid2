-- Create notification_preferences table
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Email notification preferences
  email_invoice_sent boolean DEFAULT true,
  email_invoice_reminder boolean DEFAULT true,
  email_invoice_overdue boolean DEFAULT true,
  email_payment_received boolean DEFAULT true,
  email_payment_failed boolean DEFAULT true,
  email_quote_sent boolean DEFAULT true,
  email_quote_approved boolean DEFAULT true,
  email_job_assigned boolean DEFAULT true,
  email_job_status_changed boolean DEFAULT true,
  email_delay_notification boolean DEFAULT true,
  email_team_invite boolean DEFAULT true,
  
  -- In-app notification preferences
  inapp_invoice_activity boolean DEFAULT true,
  inapp_payment_activity boolean DEFAULT true,
  inapp_quote_activity boolean DEFAULT true,
  inapp_job_activity boolean DEFAULT true,
  inapp_team_activity boolean DEFAULT true,
  inapp_geofence_alerts boolean DEFAULT true,
  
  -- Digest/summary preferences
  daily_digest boolean DEFAULT false,
  weekly_summary boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own preferences
CREATE POLICY "Users can manage own preferences" 
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Auto-update updated_at using existing function
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();