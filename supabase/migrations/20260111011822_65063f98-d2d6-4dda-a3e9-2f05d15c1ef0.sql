-- Add staff reply columns to photo_comments table
ALTER TABLE photo_comments 
ADD COLUMN IF NOT EXISTS staff_reply text,
ADD COLUMN IF NOT EXISTS staff_reply_at timestamptz;

-- Add constraint for staff reply length
ALTER TABLE photo_comments
ADD CONSTRAINT check_staff_reply_length CHECK (staff_reply IS NULL OR char_length(staff_reply) <= 2000);