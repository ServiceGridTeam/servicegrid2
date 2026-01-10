import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { toast } from 'sonner';
import { tagOperationLimiter } from '@/lib/rateLimiter';
import type { MediaTag } from './useTags';

export interface JobMediaTag {
  id: string;
  job_media_id: string;
  tag_id: string;
  business_id: string;
  tagged_by: string | null;
  tagged_at: string;
  source: 'manual' | 'ai_suggested' | 'bulk_operation' | 'auto_rule';
  tag?: MediaTag;
}

// Fetch tags for a specific photo
export function usePhotoTags(mediaId: string | null) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['photo-tags', mediaId],
    queryFn: async () => {
      if (!mediaId) return [];

      const { data, error } = await supabase
        .from('job_media_tags')
        .select(`
          *,
          tag:media_tags(*)
        `)
        .eq('job_media_id', mediaId);

      if (error) throw error;
      return data as (JobMediaTag & { tag: MediaTag })[];
    },
    enabled: !!mediaId && !!activeBusinessId,
    staleTime: 1000 * 30, // 30 sec cache
  });
}

// Add a tag to a photo (optimistic UI, with rate limiting)
export function useTagPhoto() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ mediaId, tagId }: { mediaId: string; tagId: string }) => {
      if (!activeBusinessId) throw new Error('No active business');

      // Rate limit check
      if (!tagOperationLimiter.canMakeRequest()) {
        throw new Error('Too many tag operations. Please slow down.');
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('job_media_tags')
        .insert({
          job_media_id: mediaId,
          tag_id: tagId,
          business_id: activeBusinessId,
          tagged_by: user?.id,
          source: 'manual',
        })
        .select(`*, tag:media_tags(*)`)
        .single();

      if (error) {
        if (error.code === '23505') {
          // Tag already exists on photo - not an error
          return null;
        }
        throw error;
      }

      // Record the request for rate limiting
      tagOperationLimiter.recordRequest();

      return data;
    },
    onMutate: async ({ mediaId, tagId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['photo-tags', mediaId] });

      // Snapshot previous value
      const previousTags = queryClient.getQueryData(['photo-tags', mediaId]);

      // Get the tag data for optimistic update
      const tags = queryClient.getQueryData<MediaTag[]>(['media-tags', activeBusinessId]);
      const tag = tags?.find(t => t.id === tagId);

      if (tag) {
        // Optimistically add the tag
        queryClient.setQueryData(['photo-tags', mediaId], (old: JobMediaTag[] = []) => [
          ...old,
          {
            id: `temp-${Date.now()}`,
            job_media_id: mediaId,
            tag_id: tagId,
            business_id: activeBusinessId,
            tagged_by: null,
            tagged_at: new Date().toISOString(),
            source: 'manual',
            tag,
          },
        ]);
      }

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(10);

      return { previousTags };
    },
    onError: (err, { mediaId }, context) => {
      // Rollback on error
      if (context?.previousTags) {
        queryClient.setQueryData(['photo-tags', mediaId], context.previousTags);
      }
      toast.error((err as Error).message || 'Failed to add tag');
    },
    onSettled: (_, __, { mediaId }) => {
      queryClient.invalidateQueries({ queryKey: ['photo-tags', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
    },
  });
}

// Remove a tag from a photo (optimistic UI, with rate limiting)
export function useUntagPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, tagId }: { mediaId: string; tagId: string }) => {
      // Rate limit check
      if (!tagOperationLimiter.canMakeRequest()) {
        throw new Error('Too many tag operations. Please slow down.');
      }

      const { error } = await supabase
        .from('job_media_tags')
        .delete()
        .eq('job_media_id', mediaId)
        .eq('tag_id', tagId);

      if (error) throw error;

      // Record the request for rate limiting
      tagOperationLimiter.recordRequest();
    },
    onMutate: async ({ mediaId, tagId }) => {
      await queryClient.cancelQueries({ queryKey: ['photo-tags', mediaId] });

      const previousTags = queryClient.getQueryData(['photo-tags', mediaId]);

      // Optimistically remove the tag
      queryClient.setQueryData(['photo-tags', mediaId], (old: JobMediaTag[] = []) =>
        old.filter(t => t.tag_id !== tagId)
      );

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(10);

      return { previousTags };
    },
    onError: (err, { mediaId }, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['photo-tags', mediaId], context.previousTags);
      }
      toast.error((err as Error).message || 'Failed to remove tag');
    },
    onSettled: (_, __, { mediaId }) => {
      queryClient.invalidateQueries({ queryKey: ['photo-tags', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
    },
  });
}

// Bulk tag multiple photos
export function useBulkTagPhotos() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ 
      mediaIds, 
      tagIds,
      onProgress,
    }: { 
      mediaIds: string[]; 
      tagIds: string[];
      onProgress?: (completed: number, total: number) => void;
    }) => {
      if (!activeBusinessId) throw new Error('No active business');

      const { data: { user } } = await supabase.auth.getUser();
      
      const total = mediaIds.length * tagIds.length;
      let completed = 0;

      // Create all combinations
      const inserts = mediaIds.flatMap(mediaId =>
        tagIds.map(tagId => ({
          job_media_id: mediaId,
          tag_id: tagId,
          business_id: activeBusinessId,
          tagged_by: user?.id,
          source: 'bulk_operation' as const,
        }))
      );

      // Batch insert (ignore duplicates)
      const batchSize = 50;
      for (let i = 0; i < inserts.length; i += batchSize) {
        const batch = inserts.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('job_media_tags')
          .upsert(batch, { onConflict: 'job_media_id,tag_id', ignoreDuplicates: true });

        if (error) throw error;

        completed += batch.length;
        onProgress?.(completed, total);
      }

      return { tagged: inserts.length };
    },
    onSuccess: ({ tagged }) => {
      queryClient.invalidateQueries({ queryKey: ['photo-tags'] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
      toast.success(`Tagged ${tagged} photos`);
    },
    onError: () => {
      toast.error('Failed to bulk tag photos');
    },
  });
}

// Bulk remove tags from multiple photos
export function useBulkUntagPhotos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaIds, tagIds }: { mediaIds: string[]; tagIds: string[] }) => {
      const { error } = await supabase
        .from('job_media_tags')
        .delete()
        .in('job_media_id', mediaIds)
        .in('tag_id', tagIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photo-tags'] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });
      toast.success('Tags removed');
    },
    onError: () => {
      toast.error('Failed to remove tags');
    },
  });
}
