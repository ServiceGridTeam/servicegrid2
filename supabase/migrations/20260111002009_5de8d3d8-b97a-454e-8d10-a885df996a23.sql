-- Add missing show_job_details column to photo_gallery_shares
ALTER TABLE photo_gallery_shares
ADD COLUMN IF NOT EXISTS show_job_details boolean DEFAULT true;