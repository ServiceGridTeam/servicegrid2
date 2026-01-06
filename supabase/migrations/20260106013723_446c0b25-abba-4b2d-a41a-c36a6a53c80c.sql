-- Create storage bucket for override photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('override-photos', 'override-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos to the bucket
CREATE POLICY "Authenticated users can upload override photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'override-photos');

-- Allow public read access for viewing photos
CREATE POLICY "Public read access for override photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'override-photos');

-- Allow users to update their own photos
CREATE POLICY "Users can update their own override photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'override-photos')
WITH CHECK (bucket_id = 'override-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own override photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'override-photos');