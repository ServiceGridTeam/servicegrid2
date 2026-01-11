/**
 * Hook for managing gallery sharing feature settings
 * Stored in businesses.settings JSONB field
 */

import { useBusiness, useUpdateBusiness } from './useBusiness';
import { useMemo } from 'react';

export interface GallerySharingSettings {
  photo_sharing_enabled: boolean;
  gallery_comments_enabled: boolean;
  pdf_reports_enabled: boolean;
  permanent_shares_enabled: boolean;
  gallery_branding_enabled: boolean;
  default_expiration_days: number;
}

const DEFAULT_SETTINGS: GallerySharingSettings = {
  photo_sharing_enabled: true,
  gallery_comments_enabled: true,
  pdf_reports_enabled: true,
  permanent_shares_enabled: true,
  gallery_branding_enabled: true,
  default_expiration_days: 30,
};

export function useGallerySharingSettings() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();

  // Parse settings from business.settings JSONB
  const settings = useMemo((): GallerySharingSettings => {
    if (!business?.settings) {
      return DEFAULT_SETTINGS;
    }

    const businessSettings = business.settings as Record<string, unknown>;
    const gallerySettings = businessSettings.gallery_sharing as Partial<GallerySharingSettings> | undefined;

    return {
      photo_sharing_enabled: gallerySettings?.photo_sharing_enabled ?? DEFAULT_SETTINGS.photo_sharing_enabled,
      gallery_comments_enabled: gallerySettings?.gallery_comments_enabled ?? DEFAULT_SETTINGS.gallery_comments_enabled,
      pdf_reports_enabled: gallerySettings?.pdf_reports_enabled ?? DEFAULT_SETTINGS.pdf_reports_enabled,
      permanent_shares_enabled: gallerySettings?.permanent_shares_enabled ?? DEFAULT_SETTINGS.permanent_shares_enabled,
      gallery_branding_enabled: gallerySettings?.gallery_branding_enabled ?? DEFAULT_SETTINGS.gallery_branding_enabled,
      default_expiration_days: gallerySettings?.default_expiration_days ?? DEFAULT_SETTINGS.default_expiration_days,
    };
  }, [business?.settings]);

  // Update settings - merge with existing business settings
  const updateSettings = async (newSettings: Partial<GallerySharingSettings>) => {
    if (!business) return;

    const currentSettings = (business.settings || {}) as Record<string, unknown>;
    const currentGallerySettings = (currentSettings.gallery_sharing || {}) as Partial<GallerySharingSettings>;

    const updatedSettings = {
      ...currentSettings,
      gallery_sharing: {
        ...currentGallerySettings,
        ...newSettings,
      },
    };

    await updateBusiness.mutateAsync({
      settings: updatedSettings,
    });
  };

  return {
    settings,
    isLoading,
    updateSettings,
    isUpdating: updateBusiness.isPending,
  };
}
