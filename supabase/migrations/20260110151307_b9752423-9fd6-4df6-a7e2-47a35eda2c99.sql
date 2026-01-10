-- Add missing columns to job_media for enhanced photo metadata
ALTER TABLE job_media ADD COLUMN IF NOT EXISTS gps_accuracy_meters double precision;
ALTER TABLE job_media ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE job_media ADD COLUMN IF NOT EXISTS blurhash text;
ALTER TABLE job_media ADD COLUMN IF NOT EXISTS checklist_item_id uuid;
ALTER TABLE job_media ADD COLUMN IF NOT EXISTS checklist_sequence integer;

-- Add index for content hash lookups (exact duplicate detection)
CREATE INDEX IF NOT EXISTS idx_job_media_content_hash 
ON job_media(content_hash) WHERE content_hash IS NOT NULL;

-- Add index for perceptual hash lookups (similar image detection)
CREATE INDEX IF NOT EXISTS idx_job_media_perceptual_hash 
ON job_media(perceptual_hash) WHERE perceptual_hash IS NOT NULL;

-- Add index for checklist item lookups
CREATE INDEX IF NOT EXISTS idx_job_media_checklist 
ON job_media(checklist_item_id) WHERE checklist_item_id IS NOT NULL;

-- Create function to check for duplicate photos by content hash
CREATE OR REPLACE FUNCTION check_duplicate_photo(
  p_business_id uuid,
  p_content_hash text
)
RETURNS TABLE (
  media_id uuid,
  job_id uuid,
  url text,
  is_exact_match boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    jm.id as media_id,
    jm.job_id,
    jm.url,
    true as is_exact_match
  FROM job_media jm
  WHERE jm.business_id = p_business_id
    AND jm.content_hash = p_content_hash
    AND jm.status = 'ready'
    AND jm.deleted_at IS NULL
  LIMIT 5;
END;
$$;