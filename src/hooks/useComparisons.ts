/**
 * Comparison Hooks - Before/After photo comparisons
 * Part 3 of Field Photo Documentation System
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BeforeAfterComparison,
  ComparisonWithMedia,
  ComparisonDisplayMode,
} from '@/types/annotations';

// =============================================
// Fetch Comparisons for a Job
// =============================================

export function useComparisons(jobId: string | undefined) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['comparisons', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .select(`
          *,
          before_media:job_media!before_media_id(
            id,
            url,
            thumbnail_url_md,
            thumbnail_url_lg
          ),
          after_media:job_media!after_media_id(
            id,
            url,
            thumbnail_url_md,
            thumbnail_url_lg
          )
        `)
        .eq('job_id', jobId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []) as unknown as ComparisonWithMedia[];
    },
    enabled: !!jobId && !!activeBusinessId,
  });
}

// =============================================
// Fetch Single Comparison
// =============================================

export function useComparison(comparisonId: string | undefined) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['comparison', comparisonId],
    queryFn: async () => {
      if (!comparisonId) return null;

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .select(`
          *,
          before_media:job_media!before_media_id(
            id,
            url,
            thumbnail_url_md,
            thumbnail_url_lg
          ),
          after_media:job_media!after_media_id(
            id,
            url,
            thumbnail_url_md,
            thumbnail_url_lg
          )
        `)
        .eq('id', comparisonId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;

      return data as unknown as ComparisonWithMedia;
    },
    enabled: !!comparisonId && !!activeBusinessId,
  });
}

// =============================================
// Fetch Public Comparison by Share Token
// =============================================

export function usePublicComparison(shareToken: string | undefined) {
  return useQuery({
    queryKey: ['public-comparison', shareToken],
    queryFn: async () => {
      if (!shareToken) return null;

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .select(`
          id,
          title,
          description,
          display_mode,
          before_crop,
          after_crop,
          share_expires_at,
          before_media:job_media!before_media_id(
            id,
            url,
            thumbnail_url_lg
          ),
          after_media:job_media!after_media_id(
            id,
            url,
            thumbnail_url_lg
          )
        `)
        .eq('share_token', shareToken)
        .eq('is_public', true)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      // Check if share link has expired
      if (data.share_expires_at && new Date(data.share_expires_at) < new Date()) {
        return null;
      }

      return data as unknown as ComparisonWithMedia;
    },
    enabled: !!shareToken,
  });
}

// =============================================
// Create Comparison
// =============================================

interface CreateComparisonParams {
  jobId: string;
  beforeMediaId: string;
  afterMediaId: string;
  title?: string;
  description?: string;
  displayMode?: ComparisonDisplayMode;
}

export function useCreateComparison() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      jobId,
      beforeMediaId,
      afterMediaId,
      title,
      description,
      displayMode = 'slider',
    }: CreateComparisonParams) => {
      if (!user?.id || !activeBusinessId) {
        throw new Error('User not authenticated');
      }

      if (beforeMediaId === afterMediaId) {
        throw new Error('Before and after photos must be different');
      }

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .insert({
          business_id: activeBusinessId,
          job_id: jobId,
          before_media_id: beforeMediaId,
          after_media_id: afterMediaId,
          title,
          description,
          display_mode: displayMode,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        // Handle duplicate constraint violation
        if (error.code === '23505') {
          throw new Error('A comparison with these photos already exists');
        }
        throw error;
      }

      return data as unknown as BeforeAfterComparison;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comparisons', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }

      toast.success('Comparison created');
    },
    onError: (error: Error) => {
      console.error('Failed to create comparison:', error);
      toast.error('Failed to create comparison', {
        description: error.message,
      });
    },
  });
}

// =============================================
// Update Comparison
// =============================================

interface UpdateComparisonParams {
  comparisonId: string;
  title?: string;
  description?: string;
  displayMode?: ComparisonDisplayMode;
  beforeCrop?: object;
  afterCrop?: object;
}

export function useUpdateComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      comparisonId,
      title,
      description,
      displayMode,
      beforeCrop,
      afterCrop,
    }: UpdateComparisonParams) => {
      const updates: Record<string, unknown> = {};
      
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (displayMode !== undefined) updates.display_mode = displayMode;
      if (beforeCrop !== undefined) updates.before_crop = beforeCrop;
      if (afterCrop !== undefined) updates.after_crop = afterCrop;

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .update(updates)
        .eq('id', comparisonId)
        .select()
        .single();

      if (error) throw error;

      return data as unknown as BeforeAfterComparison;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comparison', data.id] });
      queryClient.invalidateQueries({ queryKey: ['comparisons', data.job_id] });

      toast.success('Comparison updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update comparison:', error);
      toast.error('Failed to update comparison');
    },
  });
}

// =============================================
// Delete Comparison
// =============================================

interface DeleteComparisonParams {
  comparisonId: string;
  jobId: string;
}

export function useDeleteComparison() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ comparisonId }: DeleteComparisonParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('before_after_comparisons')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', comparisonId);

      if (error) throw error;
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['comparisons', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      toast.success('Comparison deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete comparison:', error);
      toast.error('Failed to delete comparison');
    },
  });
}

// =============================================
// Share Comparison
// =============================================

interface ShareComparisonParams {
  comparisonId: string;
  expiresInDays?: number; // null for permanent
}

export function useShareComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ comparisonId, expiresInDays }: ShareComparisonParams) => {
      // Generate share token using the database function
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        'generate_comparison_share_token'
      );

      if (tokenError) throw tokenError;

      const shareToken = tokenData as string;

      // Calculate expiry date
      let shareExpiresAt: string | null = null;
      if (expiresInDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiresInDays);
        shareExpiresAt = expiryDate.toISOString();
      }

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .update({
          is_public: true,
          share_token: shareToken,
          share_expires_at: shareExpiresAt,
        })
        .eq('id', comparisonId)
        .select()
        .single();

      if (error) throw error;

      // Generate share URL
      const shareUrl = `${window.location.origin}/compare/${shareToken}`;

      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // Fallback for older browsers
        console.warn('Clipboard API not available');
      }

      return {
        comparison: data as unknown as BeforeAfterComparison,
        shareUrl,
      };
    },
    onSuccess: ({ comparison, shareUrl }) => {
      queryClient.invalidateQueries({ queryKey: ['comparison', comparison.id] });
      queryClient.invalidateQueries({ queryKey: ['comparisons', comparison.job_id] });

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([10, 50, 20]);
      }

      toast.success('Share link created', {
        description: 'Link copied to clipboard',
        action: {
          label: 'Open',
          onClick: () => window.open(shareUrl, '_blank'),
        },
      });
    },
    onError: (error: Error) => {
      console.error('Failed to share comparison:', error);
      toast.error('Failed to create share link');
    },
  });
}

// =============================================
// Revoke Share Link
// =============================================

export function useRevokeShareLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (comparisonId: string) => {
      const { data, error } = await supabase
        .from('before_after_comparisons')
        .update({
          is_public: false,
          share_token: null,
          share_expires_at: null,
        })
        .eq('id', comparisonId)
        .select()
        .single();

      if (error) throw error;

      return data as unknown as BeforeAfterComparison;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comparison', data.id] });
      queryClient.invalidateQueries({ queryKey: ['comparisons', data.job_id] });

      toast.success('Share link revoked');
    },
    onError: (error: Error) => {
      console.error('Failed to revoke share link:', error);
      toast.error('Failed to revoke share link');
    },
  });
}
