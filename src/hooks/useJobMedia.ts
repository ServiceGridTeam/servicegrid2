import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { useEffect } from 'react';

export type MediaCategory = 'before' | 'during' | 'after' | 'damage' | 'equipment' | 'materials' | 'general';
export type MediaStatus = 'processing' | 'ready' | 'failed';

export interface JobMedia {
  id: string;
  business_id: string;
  job_id: string;
  customer_id: string | null;
  media_type: 'photo' | 'video';
  mime_type: string;
  file_extension: string;
  storage_path: string;
  storage_bucket: string;
  url: string | null;
  thumbnail_url_sm: string | null;
  thumbnail_url_md: string | null;
  thumbnail_url_lg: string | null;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  captured_at: string | null;
  latitude: number | null;
  longitude: number | null;
  category: MediaCategory;
  description: string | null;
  is_cover_photo: boolean;
  is_visible: boolean;
  uploaded_by: string | null;
  upload_source: 'mobile' | 'web' | 'portal';
  upload_device: string | null;
  status: MediaStatus;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Annotation extension fields
  has_annotations?: boolean;
  annotation_count?: number;
  current_annotation_id?: string | null;
}

interface UseJobMediaOptions {
  jobId: string;
  category?: MediaCategory;
  includeDeleted?: boolean;
}

export function useJobMedia({ jobId, category, includeDeleted = false }: UseJobMediaOptions) {
  const { activeBusinessId } = useBusinessContext();
  const queryClient = useQueryClient();

  const queryKey = ['job-media', jobId, category, includeDeleted];

  const { data: media = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('job_media')
        .select('*')
        .eq('job_id', jobId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobMedia[];
    },
    enabled: !!jobId,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-media-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_media',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  // Group media by category
  const mediaByCategory = media.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<MediaCategory, JobMedia[]>);

  const coverPhoto = media.find(m => m.is_cover_photo);
  const photoCount = media.filter(m => m.media_type === 'photo').length;
  const videoCount = media.filter(m => m.media_type === 'video').length;

  return {
    media,
    mediaByCategory,
    coverPhoto,
    photoCount,
    videoCount,
    isLoading,
    error,
    refetch,
  };
}

export function useSetCoverPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, mediaId }: { jobId: string; mediaId: string }) => {
      const { data, error } = await supabase.rpc('set_job_cover_photo', {
        p_job_id: jobId,
        p_media_id: mediaId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateMediaCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      mediaId, 
      category,
      description 
    }: { 
      mediaId: string; 
      category?: MediaCategory;
      description?: string;
    }) => {
      const updates: Partial<JobMedia> = {};
      if (category !== undefined) updates.category = category;
      if (description !== undefined) updates.description = description;

      const { error } = await supabase
        .from('job_media')
        .update(updates)
        .eq('id', mediaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
    },
  });
}

export function useReorderMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      mediaIds 
    }: { 
      mediaIds: string[];
    }) => {
      // Update sort_order for each media item
      const updates = mediaIds.map((id, index) => 
        supabase
          .from('job_media')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
    },
  });
}
