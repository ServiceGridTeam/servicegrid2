-- Add GPS location columns to time_entries table
ALTER TABLE time_entries
ADD COLUMN clock_in_latitude NUMERIC,
ADD COLUMN clock_in_longitude NUMERIC,
ADD COLUMN clock_out_latitude NUMERIC,
ADD COLUMN clock_out_longitude NUMERIC,
ADD COLUMN location_accuracy NUMERIC;