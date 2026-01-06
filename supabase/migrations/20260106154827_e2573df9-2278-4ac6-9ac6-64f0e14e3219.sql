-- Create customer-uploads storage bucket for service request photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-uploads', 'customer-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for customer uploads
CREATE POLICY "Public can view customer uploads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-uploads');

-- Upload policy - allow all uploads to customer-uploads bucket
CREATE POLICY "Anyone can upload to customer-uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'customer-uploads');

-- Delete policy for customer uploads
CREATE POLICY "Anyone can delete from customer-uploads"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'customer-uploads');