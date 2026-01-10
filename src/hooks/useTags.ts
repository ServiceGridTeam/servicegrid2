import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';
import { usePermission } from './usePermission';
import { toast } from 'sonner';
import { tagCreationLimiter } from '@/lib/rateLimiter';
import { validateTagName } from '@/lib/tagValidation';

export type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray';

export interface MediaTag {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: TagColor;
  icon: string | null;
  is_system: boolean;
  tag_group: string | null;
  sort_order: number;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: TagColor;
  description?: string;
  icon?: string;
  tag_group?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: TagColor;
  description?: string;
  icon?: string;
  tag_group?: string;
  sort_order?: number;
  is_active?: boolean;
}

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate unique slug with collision handling
async function generateUniqueSlug(baseName: string, businessId: string): Promise<string> {
  const baseSlug = generateSlug(baseName);
  let slug = baseSlug;
  let attempt = 0;
  const maxAttempts = 10;
  
  while (attempt < maxAttempts) {
    const { data: existing } = await supabase
      .from('media_tags')
      .select('id')
      .eq('business_id', businessId)
      .eq('slug', slug)
      .maybeSingle();
    
    if (!existing) return slug;
    
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }
  
  // Fallback: append timestamp
  return `${baseSlug}-${Date.now()}`;
}

// Fetch all tags for the active business
export function useTags() {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['media-tags', activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];

      const { data, error } = await supabase
        .from('media_tags')
        .select('*')
        .eq('business_id', activeBusinessId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data as MediaTag[];
    },
    enabled: !!activeBusinessId,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
}

// Fetch tags grouped by tag_group
export function useTagsByGroup() {
  const { data: tags = [], ...rest } = useTags();

  const tagsByGroup = tags.reduce((acc, tag) => {
    const group = tag.tag_group || 'ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(tag);
    return acc;
  }, {} as Record<string, MediaTag[]>);

  return { tagsByGroup, tags, ...rest };
}

// Create a new tag (admin+ only, with rate limiting)
export function useCreateTag() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const { allowed: canManageTags } = usePermission('admin');

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      // Permission check
      if (!canManageTags) {
        throw new Error('Permission denied: Admin access required to create tags');
      }

      if (!activeBusinessId) throw new Error('No active business');

      // Input validation
      const validation = validateTagName(input.name);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const safeName = validation.sanitized!;

      // Rate limit check
      if (!tagCreationLimiter.canMakeRequest()) {
        const resetMinutes = tagCreationLimiter.getResetTimeMinutes();
        throw new Error(`Rate limit exceeded. You can create more tags in ${resetMinutes} minute${resetMinutes !== 1 ? 's' : ''}.`);
      }

      // Generate unique slug with collision handling
      const slug = await generateUniqueSlug(safeName, activeBusinessId);

      const { data, error } = await supabase
        .from('media_tags')
        .insert({
          business_id: activeBusinessId,
          name: safeName,
          slug,
          color: input.color || 'gray',
          description: input.description,
          icon: input.icon,
          tag_group: input.tag_group,
          is_system: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Tag "${safeName}" already exists`);
        }
        throw error;
      }

      // Record the request for rate limiting
      tagCreationLimiter.recordRequest();

      return data as MediaTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
      toast.success('Tag created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create tag');
    },
  });
}

// Update an existing tag (admin+ only for name changes)
export function useUpdateTag() {
  const queryClient = useQueryClient();
  const { allowed: canManageTags } = usePermission('admin');

  return useMutation({
    mutationFn: async ({ tagId, updates }: { tagId: string; updates: UpdateTagInput }) => {
      // If updating name, require admin
      if (updates.name && !canManageTags) {
        throw new Error('Permission denied: Admin access required to rename tags');
      }

      const updateData: Record<string, unknown> = { ...updates };
      
      // If name is being updated, validate and update slug
      if (updates.name) {
        const validation = validateTagName(updates.name);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
        updateData.name = validation.sanitized;
        updateData.slug = generateSlug(validation.sanitized!);
      }

      const { data, error } = await supabase
        .from('media_tags')
        .update(updateData)
        .eq('id', tagId)
        .select()
        .single();

      if (error) throw error;
      return data as MediaTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
      toast.success('Tag updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tag');
    },
  });
}

// Delete a tag (admin+ only, non-system tags)
export function useDeleteTag() {
  const queryClient = useQueryClient();
  const { allowed: canManageTags } = usePermission('admin');

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!canManageTags) {
        throw new Error('Permission denied: Admin access required to delete tags');
      }

      const { error } = await supabase
        .from('media_tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
      toast.success('Tag deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tag');
    },
  });
}

// Reorder tags (admin+ only)
export function useReorderTags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      const updates = tagIds.map((id, index) =>
        supabase
          .from('media_tags')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags'] });
    },
  });
}

// Helper to check rate limit status
export function useTagCreationRateLimit() {
  return {
    canCreate: tagCreationLimiter.canMakeRequest(),
    remaining: tagCreationLimiter.getRemainingRequests(),
    resetTimeMinutes: tagCreationLimiter.getResetTimeMinutes(),
    isNearLimit: tagCreationLimiter.isNearLimit(),
  };
}
