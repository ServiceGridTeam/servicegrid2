/**
 * useJobChecklist Hook
 * 
 * CRUD operations for job checklists with optimistic updates,
 * haptic feedback, and camelCase transformation.
 * 
 * Phase 7 of QA Checklists Feature (v1.1)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

// Database row types
type JobChecklistRow = Database['public']['Tables']['job_checklists']['Row'];
type JobChecklistItemRow = Database['public']['Tables']['job_checklist_items']['Row'];

// CamelCase interfaces for frontend
export interface JobChecklistItem {
  id: string;
  jobChecklistId: string;
  templateItemId: string | null;
  itemOrder: number;
  label: string;
  description: string | null;
  photoRequired: boolean;
  minPhotos: number;
  maxPhotos: number;
  category: string | null;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  checkedByName: string | null;
  notes: string | null;
  photoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JobChecklist {
  id: string;
  businessId: string;
  jobId: string;
  templateId: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'waived';
  totalItems: number;
  completedItems: number;
  requiredPhotos: number;
  attachedPhotos: number;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  waivedAt: string | null;
  waivedBy: string | null;
  waiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: JobChecklistItem[];
}

// Input types for mutations
export interface CheckItemInput {
  itemId: string;
  checklistId: string;
  checked: boolean;
  notes?: string;
  photoIds?: string[];
}

export interface ApplyChecklistInput {
  jobId: string;
  templateId: string;
}

export interface CompleteChecklistInput {
  checklistId: string;
}

export interface WaiveChecklistInput {
  checklistId: string;
  reason: string;
}

// Query keys
export const jobChecklistKeys = {
  all: ['job-checklist'] as const,
  detail: (jobId: string) => [...jobChecklistKeys.all, 'detail', jobId] as const,
};

// Transform database row to camelCase
function transformChecklistItem(row: JobChecklistItemRow): JobChecklistItem {
  return {
    id: row.id,
    jobChecklistId: row.job_checklist_id,
    templateItemId: row.template_item_id,
    itemOrder: row.item_order,
    label: row.label,
    description: row.description,
    photoRequired: row.photo_required,
    minPhotos: row.min_photos,
    maxPhotos: row.max_photos,
    category: row.category,
    checked: row.checked,
    checkedAt: row.checked_at,
    checkedBy: row.checked_by,
    checkedByName: row.checked_by_name,
    notes: row.notes,
    photoIds: row.photo_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformChecklist(row: JobChecklistRow, items: JobChecklistItemRow[]): JobChecklist {
  return {
    id: row.id,
    businessId: row.business_id,
    jobId: row.job_id,
    templateId: row.template_id,
    status: row.status as JobChecklist['status'],
    totalItems: row.total_items,
    completedItems: row.completed_items,
    requiredPhotos: row.required_photos,
    attachedPhotos: row.attached_photos,
    version: row.version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    waivedAt: row.waived_at,
    waivedBy: row.waived_by,
    waiveReason: row.waive_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items
      .map(transformChecklistItem)
      .sort((a, b) => a.itemOrder - b.itemOrder),
  };
}

// Haptic feedback utilities
function hapticSuccess() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

function hapticError() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([50, 50, 50]);
  }
}

function hapticHeavy() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(100);
  }
}

/**
 * Fetch checklist for a specific job with all items
 * Returns null if no checklist exists for the job
 */
export function useJobChecklist(jobId: string | undefined) {
  return useQuery({
    queryKey: jobChecklistKeys.detail(jobId || ''),
    queryFn: async (): Promise<JobChecklist | null> => {
      if (!jobId) return null;

      // Fetch checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('job_checklists')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (checklistError) throw checklistError;
      if (!checklist) return null;

      // Fetch items
      const { data: items, error: itemsError } = await supabase
        .from('job_checklist_items')
        .select('*')
        .eq('job_checklist_id', checklist.id)
        .order('item_order', { ascending: true });

      if (itemsError) throw itemsError;

      return transformChecklist(checklist, items || []);
    },
    enabled: !!jobId,
    staleTime: 10 * 1000, // 10 seconds - shorter for active checklists
  });
}

/**
 * Check/uncheck individual checklist items with optimistic updates
 */
export function useCheckItem() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (input: CheckItemInput) => {
      const { itemId, checked, notes, photoIds } = input;

      // Get user's full name for snapshot
      const checkedByName = profile 
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';

      // Fetch the item to validate photo requirements
      const { data: item, error: fetchError } = await supabase
        .from('job_checklist_items')
        .select('photo_required, min_photos')
        .eq('id', itemId)
        .single();

      if (fetchError) throw fetchError;

      // Validate photo requirements when checking
      if (checked && item.photo_required && item.min_photos > 0) {
        const attachedPhotos = photoIds?.length || 0;
        if (attachedPhotos < item.min_photos) {
          throw new Error(`This item requires at least ${item.min_photos} photo(s). Currently attached: ${attachedPhotos}`);
        }
      }

      // Update the item
      const updateData: Record<string, unknown> = {
        checked,
        checked_at: checked ? new Date().toISOString() : null,
        checked_by: checked ? profile?.id : null,
        checked_by_name: checked ? checkedByName : null,
        updated_at: new Date().toISOString(),
      };

      if (notes !== undefined) {
        updateData.notes = notes.slice(0, 2000); // Max 2000 chars
      }

      if (photoIds !== undefined) {
        updateData.photo_ids = photoIds;
      }

      const { data, error } = await supabase
        .from('job_checklist_items')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return transformChecklistItem(data);
    },
    onMutate: async (input) => {
      // 0ms: Haptic feedback
      hapticSuccess();

      const { itemId, checklistId, checked, notes, photoIds } = input;

      // Find the jobId for this checklist
      const allQueries = queryClient.getQueriesData<JobChecklist>({ 
        queryKey: jobChecklistKeys.all 
      });
      
      let jobId: string | null = null;
      let previousChecklist: JobChecklist | undefined;

      for (const [key, data] of allQueries) {
        if (data?.id === checklistId) {
          jobId = data.jobId;
          previousChecklist = data;
          break;
        }
      }

      if (!jobId || !previousChecklist) {
        return { previousChecklist: undefined };
      }

      // Cancel in-flight queries
      await queryClient.cancelQueries({ 
        queryKey: jobChecklistKeys.detail(jobId) 
      });

      // Get user name for optimistic update
      const checkedByName = profile 
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown';

      // <50ms: Optimistic update
      const updatedItems = previousChecklist.items.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            checked,
            checkedAt: checked ? new Date().toISOString() : null,
            checkedBy: checked ? profile?.id || null : null,
            checkedByName: checked ? checkedByName : null,
            notes: notes !== undefined ? notes.slice(0, 2000) : item.notes,
            photoIds: photoIds !== undefined ? photoIds : item.photoIds,
            updatedAt: new Date().toISOString(),
          };
        }
        return item;
      });

      // Recalculate counts
      const completedItems = updatedItems.filter((i) => i.checked).length;
      const attachedPhotos = updatedItems.reduce((sum, i) => sum + i.photoIds.length, 0);

      // Derive status
      let status: JobChecklist['status'] = previousChecklist.status;
      if (completedItems === 0 && previousChecklist.status !== 'waived') {
        status = 'pending';
      } else if (completedItems > 0 && completedItems < previousChecklist.totalItems) {
        status = 'in_progress';
      }

      const optimisticChecklist: JobChecklist = {
        ...previousChecklist,
        items: updatedItems,
        completedItems,
        attachedPhotos,
        status,
        startedAt: previousChecklist.startedAt || (completedItems > 0 ? new Date().toISOString() : null),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<JobChecklist>(
        jobChecklistKeys.detail(jobId),
        optimisticChecklist
      );

      return { previousChecklist, jobId };
    },
    onError: (err, _input, context) => {
      // Rollback on error
      if (context?.previousChecklist && context?.jobId) {
        queryClient.setQueryData(
          jobChecklistKeys.detail(context.jobId),
          context.previousChecklist
        );
      }
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to update item',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSettled: (_data, _err, input) => {
      // Find the jobId and invalidate
      const allQueries = queryClient.getQueriesData<JobChecklist>({ 
        queryKey: jobChecklistKeys.all 
      });
      
      for (const [, data] of allQueries) {
        if (data?.id === input.checklistId) {
          queryClient.invalidateQueries({
            queryKey: jobChecklistKeys.detail(data.jobId),
          });
          break;
        }
      }
    },
  });
}

/**
 * Manually apply a template to an existing job
 * Calls the apply_checklist_to_job RPC
 */
export function useApplyChecklist() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (input: ApplyChecklistInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('apply_checklist_to_job', {
        p_job_id: input.jobId,
        p_template_id: input.templateId,
        p_created_by: profile.id,
      });

      if (error) throw error;
      return data as string; // Returns the new checklist ID
    },
    onMutate: () => {
      hapticSuccess();
    },
    onError: (err) => {
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to apply checklist',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (checklistId, input) => {
      toast({
        title: 'Checklist applied',
        description: 'The checklist has been added to this job',
      });
      // Invalidate the job's checklist query
      queryClient.invalidateQueries({
        queryKey: jobChecklistKeys.detail(input.jobId),
      });
    },
  });
}

/**
 * Mark checklist as completed after all items are checked
 * Calls the complete_checklist RPC
 */
export function useCompleteChecklist() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (input: CompleteChecklistInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // First fetch the checklist to validate
      const { data: checklist, error: fetchError } = await supabase
        .from('job_checklists')
        .select('*, job_checklist_items(*)')
        .eq('id', input.checklistId)
        .single();

      if (fetchError) throw fetchError;

      // Validate all items are checked
      const items = checklist.job_checklist_items as JobChecklistItemRow[];
      const uncheckedItems = items.filter((i) => !i.checked);
      if (uncheckedItems.length > 0) {
        throw new Error(`Cannot complete: ${uncheckedItems.length} item(s) are not checked`);
      }

      // Validate required photos are attached (if require_all_photos is set on template)
      const itemsWithMissingPhotos = items.filter(
        (i) => i.photo_required && i.min_photos > 0 && (i.photo_ids?.length || 0) < i.min_photos
      );
      if (itemsWithMissingPhotos.length > 0) {
        throw new Error(`Cannot complete: ${itemsWithMissingPhotos.length} item(s) are missing required photos`);
      }

      // Call the RPC
      const { data, error } = await supabase.rpc('complete_checklist', {
        p_checklist_id: input.checklistId,
        p_completed_by: profile.id,
      });

      if (error) throw error;
      return data;
    },
    onMutate: () => {
      hapticSuccess();
    },
    onError: (err) => {
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to complete checklist',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (_data, input) => {
      // Trigger confetti celebration
      hapticHeavy();
      toast({
        title: '🎉 Checklist completed!',
        description: 'Great job completing all items',
      });

      // Invalidate all checklist queries
      queryClient.invalidateQueries({
        queryKey: jobChecklistKeys.all,
      });
    },
  });
}

/**
 * Skip/waive a checklist with documented reason
 * Calls the waive_checklist RPC
 */
export function useWaiveChecklist() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (input: WaiveChecklistInput) => {
      if (!profile?.id) throw new Error('Not authenticated');

      // Validate reason length
      if (input.reason.length < 10) {
        throw new Error('Waive reason must be at least 10 characters');
      }
      if (input.reason.length > 500) {
        throw new Error('Waive reason must be less than 500 characters');
      }

      const { data, error } = await supabase.rpc('waive_checklist', {
        p_checklist_id: input.checklistId,
        p_reason: input.reason,
        p_waived_by: profile.id,
      });

      if (error) throw error;
      return data;
    },
    onMutate: () => {
      // Heavy haptic on waive confirmation
      hapticHeavy();
    },
    onError: (err) => {
      hapticError();
      toast({
        variant: 'destructive',
        title: 'Failed to waive checklist',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Checklist waived',
        description: 'The reason has been documented',
      });

      // Invalidate all checklist queries
      queryClient.invalidateQueries({
        queryKey: jobChecklistKeys.all,
      });
    },
  });
}

/**
 * Helper to calculate progress percentage
 */
export function getChecklistProgress(checklist: JobChecklist): number {
  if (checklist.totalItems === 0) return 0;
  return Math.round((checklist.completedItems / checklist.totalItems) * 100);
}

/**
 * Helper to check if checklist can be completed
 */
export function canCompleteChecklist(checklist: JobChecklist): { 
  canComplete: boolean; 
  reason?: string;
} {
  if (checklist.status === 'completed') {
    return { canComplete: false, reason: 'Already completed' };
  }
  if (checklist.status === 'waived') {
    return { canComplete: false, reason: 'Already waived' };
  }
  if (checklist.completedItems < checklist.totalItems) {
    return { 
      canComplete: false, 
      reason: `${checklist.totalItems - checklist.completedItems} item(s) not checked` 
    };
  }
  
  // Check for missing photos
  const itemsWithMissingPhotos = checklist.items.filter(
    (i) => i.photoRequired && i.minPhotos > 0 && i.photoIds.length < i.minPhotos
  );
  if (itemsWithMissingPhotos.length > 0) {
    return { 
      canComplete: false, 
      reason: `${itemsWithMissingPhotos.length} item(s) missing required photos` 
    };
  }

  return { canComplete: true };
}
