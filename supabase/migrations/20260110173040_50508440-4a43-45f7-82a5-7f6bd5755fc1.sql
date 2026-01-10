-- Add RLS policy for delete time limit on job_media
-- Technicians can only delete their own photos within 1 hour
-- Admins/Owners can delete any photo at any time

-- First, drop any existing conflicting delete policy if it exists
DROP POLICY IF EXISTS "Technicians can only delete recent photos" ON job_media;
DROP POLICY IF EXISTS "Users can delete job media in their business" ON job_media;

-- Create the new delete policy with time limit for technicians
CREATE POLICY "Users can delete job media with time limit"
ON job_media FOR DELETE
USING (
  user_belongs_to_business(business_id) AND
  (
    -- Admins and Owners can delete any photo
    EXISTS (
      SELECT 1 FROM business_memberships bm
      WHERE bm.user_id = auth.uid()
      AND bm.business_id = job_media.business_id
      AND bm.role IN ('owner', 'admin')
      AND bm.status = 'active'
    )
    OR
    -- Technicians/Viewers can only delete photos within 1 hour of creation
    (
      created_at > NOW() - INTERVAL '1 hour'
      AND uploaded_by = auth.uid()
    )
  )
);