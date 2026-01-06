-- Add foreign key columns to link time_entries with clock_events
ALTER TABLE time_entries 
  ADD COLUMN IF NOT EXISTS clock_in_event_id uuid REFERENCES clock_events(id),
  ADD COLUMN IF NOT EXISTS clock_out_event_id uuid REFERENCES clock_events(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in_event 
  ON time_entries(clock_in_event_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_out_event 
  ON time_entries(clock_out_event_id);