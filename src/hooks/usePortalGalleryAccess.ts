/**
 * Portal-specific hook for accessing active gallery shares
 * Queries for gallery shares that are active and not expired
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GalleryBranding {
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  footer_text: string | null;
}

interface Business {
  name: string;
  logo_url: string | null;
}

export interface PortalGalleryShare {
  id: string;
  share_token: string;
  custom_title: string | null;
  custom_message: string | null;
  allow_download: boolean;
  view_count: number;
  created_at: string;
  business: Business | null;
  branding: GalleryBranding | null;
}

interface UsePortalGalleryAccessOptions {
  jobId: string | undefined;
  enabled?: boolean;
}

export function usePortalGalleryAccess({ jobId, enabled = true }: UsePortalGalleryAccessOptions) {
  return useQuery({
    queryKey: ['portal-gallery-access', jobId],
    queryFn: async (): Promise<PortalGalleryShare | null> => {
      if (!jobId) return null;

      // First, get the gallery share
      const { data: shareData, error: shareError } = await supabase
        .from('photo_gallery_shares')
        .select(`
          id,
          share_token,
          custom_title,
          custom_message,
          allow_download,
          view_count,
          created_at,
          business_id,
          businesses(name, logo_url)
        `)
        .eq('job_id', jobId)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shareError) {
        console.error('Error fetching portal gallery access:', shareError);
        return null;
      }

      if (!shareData) return null;

      // Fetch branding separately using business_id
      let branding: GalleryBranding | null = null;
      if (shareData.business_id) {
        const { data: brandingData } = await supabase
          .from('gallery_brandings')
          .select('primary_color, secondary_color, logo_url, footer_text')
          .eq('business_id', shareData.business_id)
          .maybeSingle();
        
        branding = brandingData;
      }

      // Transform the response to match our interface
      const business = shareData.businesses as Business | null;

      return {
        id: shareData.id,
        share_token: shareData.share_token,
        custom_title: shareData.custom_title,
        custom_message: shareData.custom_message,
        allow_download: shareData.allow_download,
        view_count: shareData.view_count,
        created_at: shareData.created_at,
        business,
        branding,
      };
    },
    enabled: enabled && !!jobId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
