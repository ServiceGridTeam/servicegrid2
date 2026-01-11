/**
 * useChecklistTemplates Hook
 * 
 * CRUD operations for checklist templates with optimistic updates,
 * haptic feedback, and camelCase transformation.
 * 
 * Phase 5 of QA Checklists Feature (v1.1)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { Database, Json } from '@/integrations/supabase/types';

// Database row type
type ChecklistTemplateRow = Database['public']['Tables']['checklist_templates']['Row'];

// Template item schema (stored as JSONB)
export interface TemplateItem {
  id: string;
  order: number;
  label: string;
  description?: string;
  photoRequired: boolean;
  minPhotos: number;
  maxPhotos: number;
  category?: string;
}

// CamelCase template interface for frontend
export interface ChecklistTemplate {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  jobType: string | null;
  items: TemplateItem[];
  isActive: boolean;
  autoApply: boolean;
  requireAllPhotos: boolean;
  allowNotes: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input types for mutations
export interface CreateTemplateInput {
  name: string;
  description?: string;
  jobType?: string;
  items?: TemplateItem[];
  isActive?: boolean;
  autoApply?: boolean;
  requireAllPhotos?: boolean;
  allowNotes?: boolean;
}

export interface UpdateTemplateInput {
  id: string;
  name?: string;
  description?: string;
  jobType?: string;
  items?: TemplateItem[];
  isActive?: boolean;
  autoApply?: boolean;
  requireAllPhotos?: boolean;
  allowNotes?: boolean;
}

// Query keys
export const checklistTemplateKeys = {
  all: ['checklist-templates'] as const,
  list: (businessId: string) => [...checklistTemplateKeys.all, 'list', businessId] as const,
  detail: (id: string) => [...checklistTemplateKeys.all, 'detail', id] as const,
};

// Transform database row to camelCase
function transformTemplate(row: ChecklistTemplateRow): ChecklistTemplate {
  // Parse items JSONB and transform to camelCase
  const rawItems = (row.items as unknown as Array<{
    id: string;
    order: number;
    label: string;
    description?: string;
    photo_required?: boolean;
    photoRequired?: boolean;
    min_photos?: number;
    minPhotos?: number;
    max_photos?: number;
    maxPhotos?: number;
    category?: string;
  }>) || [];
  
  const items: TemplateItem[] = rawItems.map((item) => ({
    id: item.id,
    order: item.order,
    label: item.label,
    description: item.description,
    photoRequired: item.photo_required ?? item.photoRequired ?? false,
    minPhotos: item.min_photos ?? item.minPhotos ?? 0,
    maxPhotos: item.max_photos ?? item.maxPhotos ?? 5,
    category: item.category,
  }));

  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    jobType: row.job_type,
    items,
    isActive: row.is_active,
    autoApply: row.auto_apply,
    requireAllPhotos: row.require_all_photos,
    allowNotes: row.allow_notes,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Transform camelCase items to snake_case for database
function transformItemsForDb(items: TemplateItem[]): Json {
  return items.map((item) => ({
    id: item.id,
    order: item.order,
    label: item.label,
    description: item.description,
    photo_required: item.photoRequired,
    min_photos: item.minPhotos,
    max_photos: item.maxPhotos,
    category: item.category,
  })) as unknown as Json;
}

// Haptic feedback utilities
function hapticSuccess() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function hapticError() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([50, 50, 50]); // Double-tap rapid vibration
  }
}

/**
 * Fetch all checklist templates for the current business
 * @param includeInactive - Whether to include inactive templates (default: false)
 */
export function useChecklistTemplates(includeInactive = false) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive }],
    queryFn: async () => {
      if (!activeBusinessId) return [];

      let query = supabase
        .from('checklist_templates')
        .select('*')
        .eq('business_id', activeBusinessId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(transformTemplate);
    },
    enabled: !!activeBusinessId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch a single checklist template by ID
 */
export function useChecklistTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: checklistTemplateKeys.detail(templateId || ''),
    queryFn: async () => {
      if (!templateId) return null;

      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('id', templateId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return transformTemplate(data);
    },
    enabled: !!templateId,
    staleTime: 30 * 1000,
  });
}

/**
 * Create a new checklist template
 */
export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!activeBusinessId) throw new Error('No active business');
      if (!user?.id) throw new Error('Not authenticated');

      const dbInput = {
        business_id: activeBusinessId,
        created_by: user.id,
        name: input.name,
        description: input.description || null,
        job_type: input.jobType || null,
        items: input.items ? transformItemsForDb(input.items) : [],
        is_active: input.isActive ?? true,
        auto_apply: input.autoApply ?? false,
        require_all_photos: input.requireAllPhotos ?? false,
        allow_notes: input.allowNotes ?? true,
      };

      const { data, error } = await supabase
        .from('checklist_templates')
        .insert(dbInput)
        .select()
        .single();

      if (error) throw error;
      return transformTemplate(data);
    },
    onMutate: async (input) => {
      // 0ms: Haptic feedback
      hapticSuccess();

      // Cancel in-flight queries
      await queryClient.cancelQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });

      // Snapshot previous state
      const previousTemplates = queryClient.getQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }]
      );

      // <50ms: Optimistic insert
      const optimisticTemplate: ChecklistTemplate = {
        id: `temp-${Date.now()}`,
        businessId: activeBusinessId || '',
        name: input.name,
        description: input.description || null,
        jobType: input.jobType || null,
        items: input.items || [],
        isActive: input.isActive ?? true,
        autoApply: input.autoApply ?? false,
        requireAllPhotos: input.requireAllPhotos ?? false,
        allowNotes: input.allowNotes ?? true,
        deletedAt: null,
        deletedBy: null,
        createdBy: user?.id || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
        (old) => [...(old || []), optimisticTemplate].sort((a, b) => a.name.localeCompare(b.name))
      );

      return { previousTemplates };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.previousTemplates) {
        queryClient.setQueryData(
          [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
          context.previousTemplates
        );
      }
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to create template',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Checklist template created',
        description: `"${data.name}" is ready to use`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });
    },
  });
}

/**
 * Update an existing checklist template
 */
export function useUpdateChecklistTemplate() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async (input: UpdateTemplateInput) => {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.jobType !== undefined) updateData.job_type = input.jobType;
      if (input.items !== undefined) updateData.items = transformItemsForDb(input.items);
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.autoApply !== undefined) updateData.auto_apply = input.autoApply;
      if (input.requireAllPhotos !== undefined) updateData.require_all_photos = input.requireAllPhotos;
      if (input.allowNotes !== undefined) updateData.allow_notes = input.allowNotes;

      const { data, error } = await supabase
        .from('checklist_templates')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;
      return transformTemplate(data);
    },
    onMutate: async (input) => {
      hapticSuccess();

      await queryClient.cancelQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });
      await queryClient.cancelQueries({
        queryKey: checklistTemplateKeys.detail(input.id),
      });

      // Snapshot previous states
      const previousTemplates = queryClient.getQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }]
      );
      const previousTemplate = queryClient.getQueryData<ChecklistTemplate>(
        checklistTemplateKeys.detail(input.id)
      );

      // Optimistic update in list
      queryClient.setQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
        (old) =>
          (old || []).map((t) =>
            t.id === input.id
              ? {
                  ...t,
                  ...input,
                  updatedAt: new Date().toISOString(),
                }
              : t
          )
      );

      // Optimistic update in detail
      if (previousTemplate) {
        queryClient.setQueryData<ChecklistTemplate>(
          checklistTemplateKeys.detail(input.id),
          {
            ...previousTemplate,
            ...input,
            updatedAt: new Date().toISOString(),
          }
        );
      }

      return { previousTemplates, previousTemplate };
    },
    onError: (err, input, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(
          [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
          context.previousTemplates
        );
      }
      if (context?.previousTemplate) {
        queryClient.setQueryData(
          checklistTemplateKeys.detail(input.id),
          context.previousTemplate
        );
      }
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to update template',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Template updated',
        description: `"${data.name}" has been saved`,
      });
    },
    onSettled: (_, __, input) => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.detail(input.id),
      });
    },
  });
}

/**
 * Soft delete a checklist template
 */
export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('checklist_templates')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
          is_active: false,
        })
        .eq('id', templateId);

      if (error) throw error;
    },
    onMutate: async (templateId) => {
      hapticSuccess();

      await queryClient.cancelQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });

      // Snapshot previous state
      const previousTemplates = queryClient.getQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }]
      );

      // Optimistic removal from list
      queryClient.setQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
        (old) => (old || []).filter((t) => t.id !== templateId)
      );

      return { previousTemplates };
    },
    onError: (err, _templateId, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(
          [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: false }],
          context.previousTemplates
        );
      }
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to delete template',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Template deleted',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });
    },
  });
}

/**
 * Toggle template active state
 */
export function useToggleTemplateActive() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ templateId, isActive }: { templateId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;
      return transformTemplate(data);
    },
    onMutate: async ({ templateId, isActive }) => {
      hapticSuccess();

      await queryClient.cancelQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });

      const previousTemplates = queryClient.getQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: true }]
      );

      queryClient.setQueryData<ChecklistTemplate[]>(
        [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: true }],
        (old) =>
          (old || []).map((t) =>
            t.id === templateId ? { ...t, isActive } : t
          )
      );

      return { previousTemplates };
    },
    onError: (err, _, context) => {
      if (context?.previousTemplates) {
        queryClient.setQueryData(
          [...checklistTemplateKeys.list(activeBusinessId || ''), { includeInactive: true }],
          context.previousTemplates
        );
      }
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to update template',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (data) => {
      toast({
        title: data.isActive ? 'Template activated' : 'Template deactivated',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: checklistTemplateKeys.list(activeBusinessId || ''),
      });
    },
  });
}
