-- Create job-media-thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-media-thumbnails', 'job-media-thumbnails', false, 1048576, 
        ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for thumbnails bucket (same as job-media)
CREATE POLICY "Users can view thumbnails for their business jobs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-media-thumbnails' AND
  EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.user_id = auth.uid()
    AND bm.business_id::text = (storage.foldername(name))[1]
    AND bm.status = 'active'
  )
);

CREATE POLICY "Users can upload thumbnails for their business"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-media-thumbnails' AND
  EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.user_id = auth.uid()
    AND bm.business_id::text = (storage.foldername(name))[1]
    AND bm.status = 'active'
  )
);

CREATE POLICY "Users can delete thumbnails for their business"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-media-thumbnails' AND
  EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.user_id = auth.uid()
    AND bm.business_id::text = (storage.foldername(name))[1]
    AND bm.status = 'active'
  )
);

-- Service role can manage all thumbnails (for edge function)
CREATE POLICY "Service role can manage thumbnails"
ON storage.objects FOR ALL
USING (bucket_id = 'job-media-thumbnails')
WITH CHECK (bucket_id = 'job-media-thumbnails');