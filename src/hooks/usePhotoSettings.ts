import { useBusiness, useUpdateBusiness } from "./useBusiness";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { MediaCategory } from "./useJobMedia";

export interface PhotoSettings {
  require_gps: boolean;
  require_timestamp: boolean;
  auto_watermark: boolean;
  watermark_position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  max_photo_size_mb: number;
  max_video_duration_seconds: number;
  allowed_categories: MediaCategory[];
  default_thumbnail_quality: number;
}

const DEFAULT_PHOTO_SETTINGS: PhotoSettings = {
  require_gps: false,
  require_timestamp: true,
  auto_watermark: false,
  watermark_position: 'bottom-right',
  max_photo_size_mb: 10,
  max_video_duration_seconds: 60,
  allowed_categories: ['before', 'during', 'after', 'damage', 'equipment', 'materials', 'general'],
  default_thumbnail_quality: 80,
};

export function usePhotoSettings() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();

  // Extract photo settings from business.settings JSONB
  const photoSettings = useMemo<PhotoSettings>(() => {
    if (!business?.settings) {
      return DEFAULT_PHOTO_SETTINGS;
    }

    const settings = business.settings as Record<string, unknown>;
    const storedPhotoSettings = settings.photo_settings as Partial<PhotoSettings> | undefined;

    return {
      ...DEFAULT_PHOTO_SETTINGS,
      ...storedPhotoSettings,
    };
  }, [business?.settings]);

  // Update photo settings
  const updatePhotoSettings = useCallback(
    async (updates: Partial<PhotoSettings>) => {
      if (!business) {
        toast.error("No business found");
        return;
      }

      const currentSettings = (business.settings as Record<string, unknown>) || {};
      const currentPhotoSettings = (currentSettings.photo_settings as Partial<PhotoSettings>) || {};

      const newSettings = {
        ...currentSettings,
        photo_settings: {
          ...currentPhotoSettings,
          ...updates,
        },
      };

      try {
        await updateBusiness.mutateAsync({ settings: newSettings });
        toast.success("Photo settings updated");
      } catch (error) {
        console.error("Failed to update photo settings:", error);
        toast.error("Failed to update photo settings");
        throw error;
      }
    },
    [business, updateBusiness]
  );

  return {
    photoSettings,
    isLoading,
    updatePhotoSettings,
    isUpdating: updateBusiness.isPending,
  };
}

export { DEFAULT_PHOTO_SETTINGS };
