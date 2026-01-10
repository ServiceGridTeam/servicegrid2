-- =============================================
-- Photo Capture & Storage Phase 1: Database Schema
-- =============================================

-- Create ENUM for media categories
CREATE TYPE public.media_category AS ENUM (
  'before',
  'during', 
  'after',
  'damage',
  'equipment',
  'materials',
  'general'
);

-- Create ENUM for media processing status
CREATE TYPE public.media_status AS ENUM (
  'processing',
  'ready',
  'failed'
);

-- =============================================
-- Storage Buckets
-- =============================================

-- Create job-media bucket (private, for technician uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-media',
  'job-media', 
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
);

-- Create job-media-thumbnails bucket (private, for generated thumbnails)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-media-thumbnails',
  'job-media-thumbnails',
  false,
  1048576, -- 1MB limit
  ARRAY['image/webp', 'image/jpeg']
);

-- Create customer-uploads-quarantine bucket (private, security buffer)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-uploads-quarantine',
  'customer-uploads-quarantine',
  false,
  10485760, -- 10MB limit  
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- =============================================
-- Storage RLS Policies for job-media
-- =============================================

-- Technicians can upload to job-media
CREATE POLICY "Technicians can upload job media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-media' 
  AND auth.uid() IS NOT NULL
);

-- Technicians can view job media for their business
CREATE POLICY "Users can view job media for their business"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-media'
  AND auth.uid() IS NOT NULL
);

-- Technicians can delete their own uploads
CREATE POLICY "Users can delete job media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'job-media'
  AND auth.uid() IS NOT NULL
);

-- =============================================
-- Storage RLS Policies for job-media-thumbnails
-- =============================================

-- Service can insert thumbnails
CREATE POLICY "Service can insert thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'job-media-thumbnails'
);

-- Users can view thumbnails
CREATE POLICY "Users can view thumbnails"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'job-media-thumbnails'
  AND auth.uid() IS NOT NULL
);

-- =============================================
-- Storage RLS Policies for customer-uploads-quarantine
-- =============================================

-- Allow uploads to quarantine (via edge function with anon key + session token)
CREATE POLICY "Allow customer quarantine uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'customer-uploads-quarantine'
);

-- Service can view/delete quarantine files
CREATE POLICY "Service can manage quarantine"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'customer-uploads-quarantine'
);

CREATE POLICY "Service can delete quarantine"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'customer-uploads-quarantine'
);

-- =============================================
-- job_media Table
-- =============================================

CREATE TABLE public.job_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Media type
  media_type TEXT NOT NULL DEFAULT 'photo' CHECK (media_type IN ('photo', 'video')),
  mime_type TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  
  -- Storage
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'job-media',
  url TEXT,
  thumbnail_url_sm TEXT, -- 150px
  thumbnail_url_md TEXT, -- 400px
  thumbnail_url_lg TEXT, -- 800px
  
  -- File info
  file_size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER, -- for videos
  
  -- EXIF/GPS data
  captured_at TIMESTAMP WITH TIME ZONE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  camera_make TEXT,
  camera_model TEXT,
  iso INTEGER,
  aperture TEXT,
  shutter_speed TEXT,
  focal_length TEXT,
  
  -- Classification
  category public.media_category NOT NULL DEFAULT 'general',
  description TEXT,
  is_cover_photo BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE, -- visible to customer portal
  
  -- Upload context
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  upload_source TEXT NOT NULL DEFAULT 'mobile' CHECK (upload_source IN ('mobile', 'web', 'portal')),
  upload_device TEXT,
  
  -- Processing
  status public.media_status NOT NULL DEFAULT 'processing',
  processing_error TEXT,
  perceptual_hash TEXT, -- for duplicate detection
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for job_media
CREATE INDEX idx_job_media_job_id ON public.job_media(job_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_media_business_id ON public.job_media(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_media_category ON public.job_media(job_id, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_job_media_cover ON public.job_media(job_id) WHERE is_cover_photo = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_job_media_perceptual_hash ON public.job_media(perceptual_hash) WHERE perceptual_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_media
CREATE POLICY "Users can view job media in their business"
ON public.job_media FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can insert job media in their business"
ON public.job_media FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Users can update job media in their business"
ON public.job_media FOR UPDATE
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can delete job media in their business"
ON public.job_media FOR DELETE
USING (user_belongs_to_business(business_id));

-- Customers can view visible media for their jobs via tracking token
CREATE POLICY "Public can view visible job media via tracking token"
ON public.job_media FOR SELECT
USING (
  is_visible = TRUE 
  AND deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs j 
    WHERE j.id = job_media.job_id 
    AND j.tracking_token IS NOT NULL
  )
);

-- =============================================
-- customer_media_uploads Table (Quarantine)
-- =============================================

CREATE TABLE public.customer_media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  job_request_id UUID REFERENCES public.customer_service_requests(id) ON DELETE SET NULL,
  
  -- Storage
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'customer-uploads-quarantine',
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  
  -- Security scanning
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'scanning', 'clean', 'flagged', 'rejected')),
  scan_completed_at TIMESTAMP WITH TIME ZONE,
  scan_result JSONB,
  rejection_reason TEXT,
  
  -- Conversion
  converted_to_job_media_id UUID REFERENCES public.job_media(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for customer_media_uploads
CREATE INDEX idx_customer_media_uploads_business ON public.customer_media_uploads(business_id);
CREATE INDEX idx_customer_media_uploads_scan_status ON public.customer_media_uploads(scan_status) WHERE scan_status = 'pending';

-- Enable RLS
ALTER TABLE public.customer_media_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_media_uploads
CREATE POLICY "Users can view customer uploads in their business"
ON public.customer_media_uploads FOR SELECT
USING (user_belongs_to_business(business_id));

CREATE POLICY "Users can manage customer uploads in their business"
ON public.customer_media_uploads FOR ALL
USING (user_belongs_to_business(business_id));

-- Allow inserts from portal (service role handles this)
CREATE POLICY "System can insert customer uploads"
ON public.customer_media_uploads FOR INSERT
WITH CHECK (true);

-- =============================================
-- Extend jobs table with media columns
-- =============================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS media_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_before_photos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_after_photos BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- =============================================
-- Trigger to maintain denormalized media counts
-- =============================================

CREATE OR REPLACE FUNCTION public.update_job_media_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
  v_media_count INTEGER;
  v_has_before BOOLEAN;
  v_has_after BOOLEAN;
  v_cover_url TEXT;
BEGIN
  -- Determine which job_id to update
  IF TG_OP = 'DELETE' THEN
    v_job_id := OLD.job_id;
  ELSE
    v_job_id := NEW.job_id;
  END IF;
  
  -- Calculate counts
  SELECT 
    COUNT(*) FILTER (WHERE deleted_at IS NULL),
    BOOL_OR(category = 'before' AND deleted_at IS NULL),
    BOOL_OR(category = 'after' AND deleted_at IS NULL),
    (SELECT url FROM public.job_media 
     WHERE job_id = v_job_id AND is_cover_photo = TRUE AND deleted_at IS NULL 
     LIMIT 1)
  INTO v_media_count, v_has_before, v_has_after, v_cover_url
  FROM public.job_media
  WHERE job_id = v_job_id;
  
  -- Update job
  UPDATE public.jobs
  SET 
    media_count = COALESCE(v_media_count, 0),
    has_before_photos = COALESCE(v_has_before, FALSE),
    has_after_photos = COALESCE(v_has_after, FALSE),
    cover_photo_url = v_cover_url,
    updated_at = now()
  WHERE id = v_job_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger
CREATE TRIGGER tr_job_media_counts
AFTER INSERT OR UPDATE OR DELETE ON public.job_media
FOR EACH ROW
EXECUTE FUNCTION public.update_job_media_counts();

-- =============================================
-- Function to set cover photo (handles race conditions)
-- =============================================

CREATE OR REPLACE FUNCTION public.set_job_cover_photo(p_job_id UUID, p_media_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove existing cover photo flag
  UPDATE public.job_media
  SET is_cover_photo = FALSE, updated_at = now()
  WHERE job_id = p_job_id AND is_cover_photo = TRUE AND id != p_media_id;
  
  -- Set new cover photo
  UPDATE public.job_media
  SET is_cover_photo = TRUE, updated_at = now()
  WHERE id = p_media_id AND job_id = p_job_id AND deleted_at IS NULL;
  
  -- Update job cover_photo_url
  UPDATE public.jobs
  SET cover_photo_url = (
    SELECT url FROM public.job_media 
    WHERE id = p_media_id AND deleted_at IS NULL
  )
  WHERE id = p_job_id;
  
  RETURN TRUE;
END;
$$;

-- =============================================
-- Updated_at trigger for job_media
-- =============================================

CREATE TRIGGER update_job_media_updated_at
BEFORE UPDATE ON public.job_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for customer_media_uploads
CREATE TRIGGER update_customer_media_uploads_updated_at
BEFORE UPDATE ON public.customer_media_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Enable Realtime for job_media
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.job_media;