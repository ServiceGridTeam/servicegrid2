/**
 * Annotation Hooks - CRUD operations for photo annotations
 * Part 3 of Field Photo Documentation System
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AnnotationData,
  MediaAnnotation,
  DEFAULT_ANNOTATION_DATA,
} from '@/types/annotations';
import {
  validateAnnotationData,
  sanitizeAnnotationData,
} from '@/lib/annotationValidation';

// =============================================
// Fetch Current Annotation
// =============================================

export function useAnnotation(mediaId: string | undefined) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['annotation', mediaId],
    queryFn: async () => {
      if (!mediaId) return null;

      const { data, error } = await supabase
        .from('media_annotations')
        .select('*')
        .eq('job_media_id', mediaId)
        .eq('is_current', true)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;

      // Parse and validate annotation data
      const annotationData = data.annotation_data as unknown as AnnotationData;
      
      return {
        ...data,
        annotation_data: annotationData,
      } as MediaAnnotation;
    },
    enabled: !!mediaId && !!activeBusinessId,
  });
}

// =============================================
// Fetch Annotation History
// =============================================

export function useAnnotationHistory(mediaId: string | undefined) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['annotation-history', mediaId],
    queryFn: async () => {
      if (!mediaId) return [];

      const { data, error } = await supabase
        .from('media_annotations')
        .select('*')
        .eq('job_media_id', mediaId)
        .is('deleted_at', null)
        .order('version', { ascending: false });

      if (error) throw error;

      return (data || []).map((item) => ({
        ...item,
        annotation_data: item.annotation_data as unknown as AnnotationData,
      })) as MediaAnnotation[];
    },
    enabled: !!mediaId && !!activeBusinessId,
  });
}

// =============================================
// Save Annotation
// =============================================

interface SaveAnnotationParams {
  mediaId: string;
  annotationData: AnnotationData;
}

export function useSaveAnnotation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ mediaId, annotationData }: SaveAnnotationParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Validate annotation data
      const validation = validateAnnotationData(annotationData);
      if (!validation.valid) {
        throw new Error(`Invalid annotation data: ${validation.errors.join(', ')}`);
      }

      // Log any warnings
      if (validation.warnings.length > 0) {
        console.warn('Annotation validation warnings:', validation.warnings);
      }

      // Sanitize data before saving
      const sanitizedData = sanitizeAnnotationData(annotationData);

      // Call the save_annotation_version RPC function
      const { data, error } = await supabase.rpc('save_annotation_version', {
        p_media_id: mediaId,
        p_annotation_data: sanitizedData as unknown as Parameters<typeof supabase.rpc<'save_annotation_version'>>[1]['p_annotation_data'],
        p_user_id: user.id,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; annotation_id?: string; version?: number; error?: string; message?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save annotation');
      }

      return result;
    },
    onSuccess: (result, { mediaId }) => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['annotation', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['annotation-history', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });

      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate([10, 50, 20]); // light-pause-medium pattern
      }

      toast.success('Annotation saved');
    },
    onError: (error: Error) => {
      console.error('Failed to save annotation:', error);
      
      // Error haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 50]); // double-tap pattern
      }

      toast.error('Failed to save annotation', {
        description: error.message,
      });
    },
  });
}

// =============================================
// Revert to Previous Version
// =============================================

interface RevertAnnotationParams {
  mediaId: string;
  versionId: string;
}

export function useRevertAnnotation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ mediaId, versionId }: RevertAnnotationParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch the version to revert to
      const { data: versionData, error: fetchError } = await supabase
        .from('media_annotations')
        .select('annotation_data')
        .eq('id', versionId)
        .single();

      if (fetchError) throw fetchError;
      if (!versionData) throw new Error('Version not found');

      // Save as new version (revert creates new version, doesn't overwrite)
      const { data, error } = await supabase.rpc('save_annotation_version', {
        p_media_id: mediaId,
        p_annotation_data: versionData.annotation_data as Parameters<typeof supabase.rpc<'save_annotation_version'>>[1]['p_annotation_data'],
        p_user_id: user.id,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; annotation_id?: string; version?: number; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to revert annotation');
      }

      return result;
    },
    onSuccess: (result, { mediaId }) => {
      queryClient.invalidateQueries({ queryKey: ['annotation', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['annotation-history', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });

      // Medium haptic for restore
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }

      toast.success('Reverted to previous version');
    },
    onError: (error: Error) => {
      console.error('Failed to revert annotation:', error);
      toast.error('Failed to revert annotation', {
        description: error.message,
      });
    },
  });
}

// =============================================
// Delete Annotation
// =============================================

interface DeleteAnnotationParams {
  annotationId: string;
  mediaId: string;
}

export function useDeleteAnnotation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ annotationId }: DeleteAnnotationParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('media_annotations')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', annotationId);

      if (error) throw error;
    },
    onSuccess: (_, { mediaId }) => {
      queryClient.invalidateQueries({ queryKey: ['annotation', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['annotation-history', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['job-media'] });

      toast.success('Annotation deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete annotation:', error);
      toast.error('Failed to delete annotation');
    },
  });
}

// =============================================
// Create Empty Annotation
// =============================================

export function createEmptyAnnotation(canvasWidth: number, canvasHeight: number): AnnotationData {
  return {
    ...DEFAULT_ANNOTATION_DATA,
    canvas: { width: canvasWidth, height: canvasHeight },
  };
}
