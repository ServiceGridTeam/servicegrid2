/**
 * Gallery Comments Moderation Hook
 * Staff-facing hook for managing gallery comments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useProfile } from './useProfile';
import { useToast } from './use-toast';

export interface ModerationComment {
  id: string;
  business_id: string;
  share_id: string | null;
  job_media_id: string;
  author_name: string;
  author_email: string | null;
  author_type: string;
  comment_text: string;
  is_question: boolean;
  is_read: boolean;
  is_resolved: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
  staff_reply: string | null;
  staff_reply_at: string | null;
  admin_id: string | null;
  parent_comment_id: string | null;
  reply_depth: number;
  created_at: string;
  updated_at: string;
  // Joined data
  job_media?: {
    id: string;
    thumbnail_url_sm: string | null;
    job_id: string;
    job?: {
      id: string;
      job_number: string;
      title: string | null;
    };
  };
  share?: {
    id: string;
    custom_title: string | null;
  };
  admin?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

interface CommentsFilter {
  jobId?: string;
  shareId?: string;
  unreadOnly?: boolean;
  questionsOnly?: boolean;
}

/**
 * Get all comments for a business with optional filtering
 */
export function useGalleryCommentsModeration(filter?: CommentsFilter) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['gallery-comments-moderation', business?.id, filter],
    queryFn: async () => {
      if (!business?.id) return [];

      let query = supabase
        .from('photo_comments')
        .select(`
          *,
          job_media:job_media_id(
            id,
            thumbnail_url_sm,
            job_id,
            job:jobs(id, job_number, title)
          ),
          share:share_id(id, custom_title),
          admin:profiles!photo_comments_admin_id_fkey(id, first_name, last_name)
        `)
        .eq('business_id', business.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter?.jobId) {
        // Get job_media_ids for this job
        const { data: mediaIds } = await supabase
          .from('job_media')
          .select('id')
          .eq('job_id', filter.jobId);
        
        if (mediaIds && mediaIds.length > 0) {
          query = query.in('job_media_id', mediaIds.map(m => m.id));
        } else {
          return [];
        }
      }

      if (filter?.shareId) {
        query = query.eq('share_id', filter.shareId);
      }

      if (filter?.unreadOnly) {
        query = query.eq('is_read', false);
      }

      if (filter?.questionsOnly) {
        query = query.eq('is_question', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ModerationComment[];
    },
    enabled: !!business?.id,
  });
}

/**
 * Get unread comment count for a job
 */
export function useUnreadCommentCount(jobId: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['gallery-comments-unread-count', jobId],
    queryFn: async () => {
      if (!jobId || !business?.id) return 0;

      // Get job_media_ids for this job
      const { data: mediaIds } = await supabase
        .from('job_media')
        .select('id')
        .eq('job_id', jobId);

      if (!mediaIds || mediaIds.length === 0) return 0;

      const { count, error } = await supabase
        .from('photo_comments')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .in('job_media_id', mediaIds.map(m => m.id))
        .eq('is_read', false)
        .is('deleted_at', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!jobId && !!business?.id,
  });
}

/**
 * Mark comment as read
 */
export function useMarkCommentRead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, isRead }: { commentId: string; isRead: boolean }) => {
      const { data, error } = await supabase
        .from('photo_comments')
        .update({ is_read: isRead, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-unread-count'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mark comment as resolved (for questions)
 */
export function useResolveComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, isResolved }: { commentId: string; isResolved: boolean }) => {
      const { data, error } = await supabase
        .from('photo_comments')
        .update({ 
          is_resolved: isResolved, 
          is_read: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { isResolved }) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-unread-count'] });
      toast({
        title: isResolved ? 'Question resolved' : 'Question reopened',
        description: isResolved ? 'The question has been marked as resolved.' : 'The question has been reopened.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hide/unhide a comment
 */
export function useHideComment() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      commentId, 
      isHidden, 
      reason 
    }: { 
      commentId: string; 
      isHidden: boolean; 
      reason?: string;
    }) => {
      const { data, error } = await supabase
        .from('photo_comments')
        .update({ 
          is_hidden: isHidden,
          hidden_reason: isHidden ? reason || null : null,
          hidden_by: isHidden ? profile?.id || null : null,
          hidden_at: isHidden ? new Date().toISOString() : null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { isHidden }) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-moderation'] });
      toast({
        title: isHidden ? 'Comment hidden' : 'Comment restored',
        description: isHidden 
          ? 'The comment is now hidden from the public gallery.' 
          : 'The comment is now visible in the public gallery.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update comment',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Add staff reply to a comment
 */
export function useAddStaffReply() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, reply }: { commentId: string; reply: string }) => {
      const { data, error } = await supabase
        .from('photo_comments')
        .update({ 
          staff_reply: reply,
          staff_reply_at: new Date().toISOString(),
          admin_id: profile?.id || null,
          is_read: true,
          is_resolved: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-moderation'] });
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-unread-count'] });
      toast({
        title: 'Reply sent',
        description: 'Your reply has been posted to the comment.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add reply',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete staff reply
 */
export function useDeleteStaffReply() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await supabase
        .from('photo_comments')
        .update({ 
          staff_reply: null,
          staff_reply_at: null,
          admin_id: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments-moderation'] });
      toast({
        title: 'Reply deleted',
        description: 'The staff reply has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete reply',
        variant: 'destructive',
      });
    },
  });
}
