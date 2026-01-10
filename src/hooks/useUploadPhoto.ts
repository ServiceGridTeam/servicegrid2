import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { usePhotoSettings } from './usePhotoSettings';
import { useBusiness } from './useBusiness';
import { MediaCategory } from './useJobMedia';
import { toast } from 'sonner';
import { extractExifData, getCurrentPosition, ExtractedExifData } from '@/lib/exifExtractor';
import { processFileForUpload } from '@/lib/heicConverter';
import { generateThumbnails } from '@/lib/thumbnailGenerator';
import { applyWatermark, shouldApplyWatermark } from '@/lib/watermarkUtils';

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
  blurhash?: string;
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { photoSettings } = usePhotoSettings();
  const { data: business } = useBusiness();

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

      // Determine media type from processed file
      const mediaType = processedFile.type.startsWith('video/') ? 'video' : 'photo';
      
      // Apply watermark if enabled (only for photos, not videos)
      let finalFile = processedFile;
      if (mediaType === 'photo' && shouldApplyWatermark(photoSettings.auto_watermark, business?.logo_url)) {
        try {
          console.log('Applying watermark to photo...');
          const watermarkedBlob = await applyWatermark(processedFile, {
            logoUrl: business!.logo_url!,
            position: photoSettings.watermark_position,
            opacity: 0.7,
            sizePercent: 12,
            margin: 20,
          });
          finalFile = new File([watermarkedBlob], processedFile.name, { type: processedFile.type });
          console.log('Watermark applied successfully');
        } catch (err) {
          console.warn('Watermark application failed, using original:', err);
          // Continue with original file if watermarking fails
        }
      }
      
      // Generate thumbnails and blurhash client-side for images
      let thumbnails: Awaited<ReturnType<typeof generateThumbnails>> | null = null;
      if (mediaType === 'photo') {
        try {
          thumbnails = await generateThumbnails(finalFile);
          console.log('Client-side thumbnails generated:', {
            blurhash: thumbnails.blurhash.substring(0, 10) + '...',
            dimensions: `${thumbnails.width}x${thumbnails.height}`,
          });
        } catch (err) {
          console.warn('Thumbnail generation failed, will use server-side:', err);
        }
      }

      // Generate unique file path using final file (watermarked if applicable)
      const fileExt = finalFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${activeBusinessId}/${jobId}/${fileName}`;
      const baseFilename = fileName.replace(/\.[^.]+$/, '');

      // Upload original file (or watermarked) to storage
      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(storagePath, finalFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Upload client-generated thumbnails if available
      const thumbnailUrls: Record<string, string | null> = {
        sm: null,
        md: null,
        lg: null,
      };
      
      if (thumbnails) {
        const thumbnailSizes = ['sm', 'md', 'lg'] as const;
        await Promise.all(
          thumbnailSizes.map(async (size) => {
            const thumbnailPath = `${activeBusinessId}/${jobId}/thumb_${size}_${baseFilename}.webp`;
            const blob = thumbnails[size];
            
            const { error: thumbError } = await supabase.storage
              .from('job-media-thumbnails')
              .upload(thumbnailPath, blob, {
                contentType: 'image/webp',
                upsert: true,
              });
            
            if (!thumbError) {
              const { data: signedUrl } = await supabase.storage
                .from('job-media-thumbnails')
                .createSignedUrl(thumbnailPath, 60 * 60 * 24 * 365);
              thumbnailUrls[size] = signedUrl?.signedUrl || null;
            }
          })
        );
      }

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
        mime_type: finalFile.type,
        file_extension: fileExt,
        storage_path: storagePath,
        storage_bucket: 'job-media',
        url,
        file_size_bytes: finalFile.size,
        category,
        description: description || null,
        uploaded_by: user.id,
        upload_source: 'web',
        upload_device: navigator.userAgent,
        status: thumbnails ? 'ready' : 'processing', // Mark as ready if we have client thumbnails
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
        // Image dimensions from client-side or EXIF
        width: thumbnails?.width || exifData?.width || null,
        height: thumbnails?.height || exifData?.height || null,
        // Video duration (passed from client for videos)
        duration_seconds: durationSeconds || null,
        // Client-generated thumbnail URLs
        thumbnail_url_sm: thumbnailUrls.sm,
        thumbnail_url_md: thumbnailUrls.md,
        thumbnail_url_lg: thumbnailUrls.lg,
        // Blurhash for placeholder
        blurhash: thumbnails?.blurhash || null,
        // Track if watermark was applied
        is_watermarked: mediaType === 'photo' && shouldApplyWatermark(photoSettings.auto_watermark, business?.logo_url),
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

      // If we didn't generate thumbnails client-side, trigger edge function
      if (!thumbnails) {
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
      }

      // Check for duplicates after upload
      try {
        // Compute simple content hash for duplicate check (use final file - watermarked or original)
        const arrayBuffer = await finalFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const { data: duplicates } = await supabase.rpc('check_duplicate_photo', {
          p_business_id: activeBusinessId,
          p_content_hash: contentHash,
        });
        
        // If duplicates exist (more than the one we just inserted)
        if (duplicates && Array.isArray(duplicates) && duplicates.length > 1) {
          toast.warning('This photo may be a duplicate of an existing image');
        }
      } catch (err) {
        console.warn('Duplicate check failed:', err);
      }

      return {
        id: inserted.id,
        url: url || '',
        thumbnailUrl: thumbnailUrls.md,
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
