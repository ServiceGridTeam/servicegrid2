import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { usePhotoSettings } from './usePhotoSettings';
import { MediaCategory } from './useJobMedia';
import { toast } from 'sonner';
import { extractExifData, getCurrentPosition, ExtractedExifData } from '@/lib/exifExtractor';
import { processFileForUpload } from '@/lib/heicConverter';

interface UploadPhotoParams {
  jobId: string;
  customerId?: string;
  file: File;
  category?: MediaCategory;
  description?: string;
  checklistItemId?: string;
  durationSeconds?: number; // For video uploads
}

interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl: string | null;
}

// Optimistic entry type for cache
interface OptimisticMediaEntry {
  id: string;
  url: string;
  thumbnail_url_md: string | null;
  status: 'uploading';
  category: MediaCategory;
  media_type: 'photo' | 'video';
  created_at: string;
  description: string | null;
  is_cover_photo: boolean;
  duration_seconds: number | null;
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { photoSettings } = usePhotoSettings();

  return useMutation({
    mutationFn: async ({
      jobId,
      customerId,
      file,
      category = 'general',
      description,
      checklistItemId,
      durationSeconds,
    }: UploadPhotoParams): Promise<UploadResult> => {
      if (!activeBusinessId) {
        throw new Error('No active business');
      }

      // Check file size limit
      const maxSizeBytes = photoSettings.max_photo_size_mb * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error(`File too large. Maximum size is ${photoSettings.max_photo_size_mb}MB`);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Process file - convert HEIC to JPEG if needed
      // Extract EXIF from ORIGINAL file before conversion (heic2any strips EXIF)
      const [processedResult, exifData, gpsPosition] = await Promise.all([
        processFileForUpload(file),
        extractExifData(file), // Extract from original before any conversion
        getCurrentPosition(),
      ]);

      // Use the processed file (converted if HEIC, otherwise original)
      const processedFile = processedResult.file;
      if (processedResult.wasConverted) {
        console.log('HEIC file converted to JPEG:', file.name, '->', processedFile.name);
      }

      // Generate unique file path using processed file
      const fileExt = processedFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${activeBusinessId}/${jobId}/${fileName}`;

      // Determine media type from processed file
      const mediaType = processedFile.type.startsWith('video/') ? 'video' : 'photo';

      // Upload processed file to storage
      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(storagePath, processedFile, {
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
        mime_type: processedFile.type,
        file_extension: fileExt,
        storage_path: storagePath,
        storage_bucket: 'job-media',
        url,
        file_size_bytes: processedFile.size,
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
        // Video duration (passed from client for videos)
        duration_seconds: durationSeconds || null,
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
    onMutate: async ({ jobId, file, category = 'general', durationSeconds }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['job-media', jobId] });
      await queryClient.cancelQueries({ queryKey: ['jobs'] });

      // Snapshot previous value
      const previousMedia = queryClient.getQueryData(['job-media', jobId]);

      // Determine media type
      const mediaType = file.type.startsWith('video/') ? 'video' : 'photo';

      // Create optimistic entry with local URL
      const optimisticEntry: OptimisticMediaEntry = {
        id: `optimistic-${crypto.randomUUID()}`,
        url: URL.createObjectURL(file),
        thumbnail_url_md: null,
        status: 'uploading',
        category,
        media_type: mediaType,
        created_at: new Date().toISOString(),
        description: null,
        is_cover_photo: false,
        duration_seconds: durationSeconds || null,
      };

      // Optimistically add to cache
      queryClient.setQueryData(['job-media', jobId], (old: unknown[] | undefined) => {
        return [...(old || []), optimisticEntry];
      });

      return { previousMedia, optimisticEntry };
    },
    onSuccess: (result, { jobId }, context) => {
      // Remove optimistic entry and let query refetch with real data
      if (context?.optimisticEntry) {
        // Revoke the object URL
        URL.revokeObjectURL(context.optimisticEntry.url);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error, { jobId }, context) => {
      console.error('Upload failed:', error);
      
      // Rollback to previous state
      if (context?.previousMedia !== undefined) {
        queryClient.setQueryData(['job-media', jobId], context.previousMedia);
      }
      
      // Revoke object URL if created
      if (context?.optimisticEntry) {
        URL.revokeObjectURL(context.optimisticEntry.url);
      }
      
      toast.error('Failed to upload photo');
    },
  });
}

// Re-export utilities for backward compatibility
export { extractExifData, getCurrentPosition } from '@/lib/exifExtractor';
export type { ExtractedExifData };
