import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeletePhotoParams {
  mediaId: string;
  jobId: string;
  hardDelete?: boolean;
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, jobId, hardDelete = false }: DeletePhotoParams) => {
      if (hardDelete) {
        // Get the storage path first
        const { data: media, error: fetchError } = await supabase
          .from('job_media')
          .select('storage_path, storage_bucket')
          .eq('id', mediaId)
          .single();

        if (fetchError) throw fetchError;

        // Delete from storage
        if (media?.storage_path) {
          await supabase.storage
            .from(media.storage_bucket)
            .remove([media.storage_path]);
        }

        // Hard delete the record
        const { error } = await supabase
          .from('job_media')
          .delete()
          .eq('id', mediaId);

        if (error) throw error;
      } else {
        // Soft delete - just set deleted_at
        const { error } = await supabase
          .from('job_media')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', mediaId);

        if (error) throw error;
      }

      return { mediaId, jobId };
    },
    onMutate: async ({ mediaId, jobId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['job-media', jobId] });

      // Snapshot previous value
      const previousMedia = queryClient.getQueryData(['job-media', jobId]);

      // Optimistically remove from cache
      queryClient.setQueryData(['job-media', jobId, undefined, false], (old: any[] | undefined) => {
        if (!old) return old;
        return old.filter(m => m.id !== mediaId);
      });

      return { previousMedia };
    },
    onSuccess: ({ mediaId, jobId }, _, context) => {
      queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      // Show undo toast for soft deletes
      toast.success('Photo deleted', {
        action: {
          label: 'Undo',
          onClick: () => {
            // Restore the photo
            supabase
              .from('job_media')
              .update({ deleted_at: null })
              .eq('id', mediaId)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
                toast.success('Photo restored');
              });
          },
        },
        duration: 5000,
      });
    },
    onError: (error, { jobId }, context) => {
      // Rollback on error
      if (context?.previousMedia) {
        queryClient.setQueryData(['job-media', jobId], context.previousMedia);
      }
      console.error('Delete failed:', error);
      toast.error('Failed to delete photo');
    },
  });
}

export function useRestorePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, jobId }: { mediaId: string; jobId: string }) => {
      const { error } = await supabase
        .from('job_media')
        .update({ deleted_at: null })
        .eq('id', mediaId);

      if (error) throw error;
      return { mediaId, jobId };
    },
    onSuccess: ({ jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-media', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Photo restored');
    },
    onError: (error) => {
      console.error('Restore failed:', error);
      toast.error('Failed to restore photo');
    },
  });
}
