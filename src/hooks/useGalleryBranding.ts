/**
 * Hook for managing gallery branding configuration
 * CRUD operations on the gallery_brandings table (1:1 with businesses)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from './useBusiness';

export interface GalleryBranding {
  id?: string;
  business_id: string;
  logo_url: string | null;
  background_image_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  gallery_title_template: string | null;
  footer_text: string | null;
  contact_info: string | null;
  show_powered_by: boolean | null;
  show_job_details: boolean | null;
  show_date: boolean | null;
  show_address: boolean | null;
}

export const DEFAULT_BRANDING: Omit<GalleryBranding, 'id' | 'business_id'> = {
  logo_url: null,
  background_image_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  secondary_color: '#64748b',
  background_color: '#ffffff',
  heading_font: 'Inter',
  body_font: 'Inter',
  gallery_title_template: 'Photo Gallery - Job #{job_number}',
  footer_text: null,
  contact_info: null,
  show_powered_by: true,
  show_job_details: true,
  show_date: true,
  show_address: false,
};

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
];

export const HEADING_FONT_OPTIONS = [
  ...FONT_OPTIONS,
  { value: 'Playfair Display', label: 'Playfair Display' },
];

export function useGalleryBranding() {
  const { data: business } = useBusiness();
  const queryClient = useQueryClient();

  const businessId = business?.id;

  const { data: branding, isLoading } = useQuery({
    queryKey: ['gallery-branding', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('gallery_brandings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: !!businessId,
  });

  // Merge with defaults
  const mergedBranding: GalleryBranding | null = businessId
    ? {
        business_id: businessId,
        ...DEFAULT_BRANDING,
        ...(branding || {}),
      }
    : null;

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<GalleryBranding>) => {
      if (!businessId) throw new Error('No business found');

      // Check if a record exists
      const { data: existing } = await supabase
        .from('gallery_brandings')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('gallery_brandings')
          .update(updates)
          .eq('business_id', businessId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('gallery_brandings')
          .insert({ business_id: businessId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-branding', businessId] });
    },
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error('No business found');

      const { data: existing } = await supabase
        .from('gallery_brandings')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('gallery_brandings')
          .delete()
          .eq('business_id', businessId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-branding', businessId] });
    },
  });

  return {
    branding: mergedBranding,
    isLoading,
    updateBranding: upsertMutation.mutateAsync,
    isUpdating: upsertMutation.isPending,
    resetToDefaults: resetToDefaults.mutateAsync,
    isResetting: resetToDefaults.isPending,
  };
}
