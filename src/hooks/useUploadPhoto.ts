import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { MediaCategory } from './useJobMedia';
import { toast } from 'sonner';

interface ExifData {
  captured_at?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  camera_make?: string;
  camera_model?: string;
  iso?: number;
  aperture?: string;
  shutter_speed?: string;
  focal_length?: string;
}

interface UploadPhotoParams {
  jobId: string;
  customerId?: string;
  file: File;
  category?: MediaCategory;
  description?: string;
  exifData?: ExifData;
  gpsPosition?: { latitude: number; longitude: number };
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
      exifData,
      gpsPosition,
    }: UploadPhotoParams): Promise<UploadResult> => {
      if (!activeBusinessId) {
        throw new Error('No active business');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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

      // Create job_media record with optimistic data
      const mediaRecord = {
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
        upload_source: 'web' as const,
        upload_device: navigator.userAgent,
        status: 'processing' as const,
        // EXIF data
        captured_at: exifData?.captured_at || null,
        latitude: gpsPosition?.latitude || exifData?.latitude || null,
        longitude: gpsPosition?.longitude || exifData?.longitude || null,
        altitude: exifData?.altitude || null,
        camera_make: exifData?.camera_make || null,
        camera_model: exifData?.camera_model || null,
        iso: exifData?.iso || null,
        aperture: exifData?.aperture || null,
        shutter_speed: exifData?.shutter_speed || null,
        focal_length: exifData?.focal_length || null,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('job_media')
        .insert(mediaRecord)
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

// Utility to extract EXIF data from image file
export async function extractExifData(file: File): Promise<ExifData | null> {
  // Basic implementation - can be enhanced with exif-js library
  try {
    // For now, just capture the current time if we can't read EXIF
    return {
      captured_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Utility to get current GPS position
export function getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
}
