/**
 * Gallery Shares Hook
 * TanStack Query hooks for managing photo gallery shares
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';
import { useProfile } from './useProfile';
import { useToast } from './use-toast';
import type { Database } from '@/integrations/supabase/types';

type GalleryShare = Database['public']['Tables']['photo_gallery_shares']['Row'];
type GalleryShareInsert = Database['public']['Tables']['photo_gallery_shares']['Insert'];

export interface GalleryShareWithDetails extends GalleryShare {
  creator?: {
    first_name: string | null;
    last_name: string | null;
  };
  job?: {
    job_number: string;
    title: string | null;
  };
}

interface CreateGalleryShareInput {
  jobId: string;
  customTitle?: string;
  customMessage?: string;
  expiresInDays?: number | null;
  allowDownload?: boolean;
  allowComments?: boolean;
  requireEmail?: boolean;
  includeCategories?: string[];
  excludeMediaIds?: string[];
  includeComparisons?: boolean;
  includeAnnotations?: boolean;
  isPermanent?: boolean;
  hideWatermark?: boolean;
}

interface UpdateGalleryShareInput {
  id: string;
  customTitle?: string;
  customMessage?: string;
  expiresAt?: string | null;
  allowDownload?: boolean;
  allowComments?: boolean;
  requireEmail?: boolean;
  includeCategories?: string[];
  excludeMediaIds?: string[];
  includeComparisons?: boolean;
  includeAnnotations?: boolean;
  hideWatermark?: boolean;
}

// Generate a secure token for gallery sharing
async function generateShareToken(): Promise<{ token: string; hash: string }> {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  const token = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Generate hash for the token
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { token, hash };
}

/**
 * Get all gallery shares for a specific job
 */
export function useGalleryShares(jobId: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['gallery-shares', jobId],
    queryFn: async () => {
      if (!jobId || !business?.id) return [];

      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .select(`
          *,
          creator:profiles!photo_gallery_shares_created_by_fkey(first_name, last_name)
        `)
        .eq('job_id', jobId)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GalleryShareWithDetails[];
    },
    enabled: !!jobId && !!business?.id,
  });
}

/**
 * Get a single gallery share by ID
 */
export function useGalleryShare(shareId: string | undefined) {
  return useQuery({
    queryKey: ['gallery-share', shareId],
    queryFn: async () => {
      if (!shareId) return null;

      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .select(`
          *,
          creator:profiles!photo_gallery_shares_created_by_fkey(first_name, last_name),
          job:jobs(job_number, title)
        `)
        .eq('id', shareId)
        .single();

      if (error) throw error;
      return data as GalleryShareWithDetails;
    },
    enabled: !!shareId,
  });
}

/**
 * Get the active share for a job (most recent non-revoked, non-expired)
 */
export function useActiveGalleryShare(jobId: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['gallery-share-active', jobId],
    queryFn: async () => {
      if (!jobId || !business?.id) return null;

      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .select('*')
        .eq('job_id', jobId)
        .eq('business_id', business.id)
        .eq('is_active', true)
        .is('revoked_at', null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as GalleryShare | null;
    },
    enabled: !!jobId && !!business?.id,
  });
}

/**
 * Create a new gallery share
 */
export function useCreateGalleryShare() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  const { data: profile } = useProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateGalleryShareInput) => {
      if (!business?.id || !profile?.id) {
        throw new Error('Business or profile not available');
      }

      // Generate secure token
      const { token, hash } = await generateShareToken();

      // Calculate expiration date
      let expiresAt: string | null = null;
      if (input.expiresInDays !== null && input.expiresInDays !== undefined) {
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + input.expiresInDays);
        expiresAt = expDate.toISOString();
      }

      const insertData: GalleryShareInsert = {
        business_id: business.id,
        job_id: input.jobId,
        created_by: profile.id,
        share_token: token,
        token_hash: hash,
        custom_title: input.customTitle || null,
        custom_message: input.customMessage || null,
        expires_at: expiresAt,
        allow_download: input.allowDownload ?? true,
        allow_comments: input.allowComments ?? false,
        require_email: input.requireEmail ?? false,
        include_categories: input.includeCategories || null,
        exclude_media_ids: input.excludeMediaIds || null,
        include_comparisons: input.includeComparisons ?? true,
        include_annotations: input.includeAnnotations ?? true,
        is_permanent: input.isPermanent ?? false,
        hide_watermark: input.hideWatermark ?? false,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return { ...data, share_token: token };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-shares', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share-active', data.job_id] });
      toast({
        title: 'Gallery shared',
        description: 'Share link created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create share',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update an existing gallery share
 */
export function useUpdateGalleryShare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateGalleryShareInput) => {
      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .update({
          custom_title: updates.customTitle,
          custom_message: updates.customMessage,
          expires_at: updates.expiresAt,
          allow_download: updates.allowDownload,
          allow_comments: updates.allowComments,
          require_email: updates.requireEmail,
          include_categories: updates.includeCategories,
          exclude_media_ids: updates.excludeMediaIds,
          include_comparisons: updates.includeComparisons,
          include_annotations: updates.includeAnnotations,
          hide_watermark: updates.hideWatermark,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-shares', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share', data.id] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share-active', data.job_id] });
      toast({
        title: 'Share updated',
        description: 'Gallery share settings updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update share',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Revoke a gallery share
 */
export function useRevokeGalleryShare() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (shareId: string) => {
      const { data, error } = await supabase
        .from('photo_gallery_shares')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: profile?.id || null,
        })
        .eq('id', shareId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-shares', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share', data.id] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share-active', data.job_id] });
      toast({
        title: 'Share revoked',
        description: 'The gallery share link has been disabled.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke share',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a gallery share
 */
export function useDeleteGalleryShare() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (shareId: string) => {
      // First get the share to know which job to invalidate
      const { data: share } = await supabase
        .from('photo_gallery_shares')
        .select('job_id')
        .eq('id', shareId)
        .single();

      const { error } = await supabase
        .from('photo_gallery_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;
      return { shareId, jobId: share?.job_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-shares', data.jobId] });
      queryClient.invalidateQueries({ queryKey: ['gallery-share-active', data.jobId] });
      toast({
        title: 'Share deleted',
        description: 'The gallery share has been permanently removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete share',
        variant: 'destructive',
      });
    },
  });
}
