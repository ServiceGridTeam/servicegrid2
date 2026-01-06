-- Add timesheet notification preference columns
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS inapp_timesheet_activity boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_timesheet_submitted boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_timesheet_approved boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_timesheet_rejected boolean DEFAULT true;

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;