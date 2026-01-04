-- Add column to track when reminders were last sent
ALTER TABLE invoices 
ADD COLUMN last_reminder_sent_at TIMESTAMP WITH TIME ZONE;