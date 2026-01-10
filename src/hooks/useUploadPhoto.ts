import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { MediaCategory } from './useJobMedia';
import { toast } from 'sonner';
import { extractExifData, getCurrentPosition, ExtractedExifData } from '@/lib/exifExtractor';

interface UploadPhotoParams {
  jobId: string;
  customerId?: string;
  file: File;
  category?: MediaCategory;
  description?: string;
  checklistItemId?: string;
}

interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl: string | null;
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({
      jobId,
      customerId,
      file,
      category = 'general',
      description,
      checklistItemId,
    }: UploadPhotoParams): Promise<UploadResult> => {
      if (!activeBusinessId) {
        throw new Error('No active business');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Extract EXIF data from the file (runs in parallel with GPS fetch)
      const [exifData, gpsPosition] = await Promise.all([
        extractExifData(file),
        getCurrentPosition(),
      ]);

      // Generate unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${activeBusinessId}/${jobId}/${fileName}`;

      // Determine media type
      const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get signed URL for private bucket
      const { data: signedUrlData } = await supabase.storage
        .from('job-media')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

      const url = signedUrlData?.signedUrl || null;

      // Prefer device GPS over EXIF GPS (more accurate for field photos)
      // Fall back to EXIF GPS if device GPS unavailable
      const latitude = gpsPosition?.latitude ?? exifData?.latitude ?? null;
      const longitude = gpsPosition?.longitude ?? exifData?.longitude ?? null;
      const altitude = gpsPosition?.altitude ?? exifData?.altitude ?? null;

      // Create job_media record with extracted metadata
      // Note: We build the record dynamically to avoid TypeScript errors
      // for columns that may not be in the generated types yet
      const mediaRecord: Record<string, unknown> = {
        business_id: activeBusinessId,
        job_id: jobId,
        customer_id: customerId || null,
        media_type: mediaType,
        mime_type: file.type,
        file_extension: fileExt,
        storage_path: storagePath,
        storage_bucket: 'job-media',
        url,
        file_size_bytes: file.size,
        category,
        description: description || null,
        uploaded_by: user.id,
        upload_source: 'web',
        upload_device: navigator.userAgent,
        status: 'processing',
        // GPS data (prefer device GPS, fallback to EXIF)
        latitude,
        longitude,
        altitude,
        // EXIF capture timestamp
        captured_at: exifData?.captured_at || null,
        // Camera info from EXIF
        camera_make: exifData?.camera_make || null,
        camera_model: exifData?.camera_model || null,
        // Exposure settings from EXIF
        iso: exifData?.iso || null,
        aperture: exifData?.aperture || null,
        shutter_speed: exifData?.shutter_speed || null,
        focal_length: exifData?.focal_length || null,
        // Image dimensions from EXIF
        width: exifData?.width || null,
        height: exifData?.height || null,
      };

      // Add optional fields that may not be in types yet
      if (gpsPosition?.accuracy) {
        mediaRecord.gps_accuracy_meters = gpsPosition.accuracy;
      }
      if (checklistItemId) {
        mediaRecord.checklist_item_id = checklistItemId;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertError } = await supabase
        .from('job_media')
        .insert(mediaRecord as any)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Trigger thumbnail generation edge function (fire and forget)
      supabase.functions.invoke('process-photo-upload', {
        body: {
          media_id: inserted.id,
          storage_path: storagePath,
          bucket: 'job-media',
        },
      }).then(({ error }) => {
        if (error) {
          console.error('Thumbnail generation failed:', error);
        }
      }).catch((err) => {
        console.error('Thumbnail generation error:', err);
      });

      return {
        id: inserted.id,
        url: url || '',
        thumbnailUrl: null, // Will be populated by edge function
      };
    },
    onMutate: async ({ jobId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['job-media', jobId] });
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
    },
    onSuccess: (result, { jobId }) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      toast.error('Failed to upload photo');
    },
  });
}

// Re-export utilities for backward compatibility
export { extractExifData, getCurrentPosition } from '@/lib/exifExtractor';
export type { ExtractedExifData };
