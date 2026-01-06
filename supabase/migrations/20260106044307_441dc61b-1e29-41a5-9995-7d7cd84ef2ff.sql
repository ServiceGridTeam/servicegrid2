-- Enable REPLICA IDENTITY FULL for complete row data on updates
ALTER TABLE phone_integration_logs REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE phone_integration_logs;