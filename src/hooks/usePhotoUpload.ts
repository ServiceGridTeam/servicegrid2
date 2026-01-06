import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UploadingPhoto {
  id: string;
  file: File;
  localUrl: string;
  serverUrl: string | null;
  progress: number;
  error: string | null;
}

const MAX_PHOTOS = 5;

export function usePhotoUpload() {
  const [photos, setPhotos] = useState<UploadingPhoto[]>([]);

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const newFiles = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    
    const newPhotos: UploadingPhoto[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      localUrl: URL.createObjectURL(file),
      serverUrl: null,
      progress: 0,
      error: null,
    }));

    setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));

    // Upload each photo in background
    for (const photo of newPhotos) {
      uploadPhoto(photo);
    }
  }, [photos.length]);

  const uploadPhoto = async (photo: UploadingPhoto) => {
    try {
      const fileExt = photo.file.name.split('.').pop();
      const fileName = `${Date.now()}-${photo.id}.${fileExt}`;
      const filePath = `service-requests/${fileName}`;

      // Update progress to indicate upload started
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, progress: 10 } : p
      ));

      const { error: uploadError } = await supabase.storage
        .from('customer-uploads')
        .upload(filePath, photo.file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('customer-uploads')
        .getPublicUrl(filePath);

      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { ...p, serverUrl: urlData.publicUrl, progress: 100 } 
          : p
      ));
    } catch (err) {
      console.error('Photo upload error:', err);
      setPhotos(prev => prev.map(p => 
        p.id === photo.id 
          ? { ...p, error: err instanceof Error ? err.message : 'Upload failed', progress: 0 } 
          : p
      ));
    }
  };

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo?.localUrl) {
        URL.revokeObjectURL(photo.localUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  }, []);

  const retryUpload = useCallback((id: string) => {
    const photo = photos.find(p => p.id === id);
    if (photo) {
      setPhotos(prev => prev.map(p => 
        p.id === id ? { ...p, error: null, progress: 0 } : p
      ));
      uploadPhoto(photo);
    }
  }, [photos]);

  const getUrls = useCallback(() => {
    return photos
      .filter(p => p.serverUrl)
      .map(p => p.serverUrl as string);
  }, [photos]);

  const isUploading = photos.some(p => p.progress > 0 && p.progress < 100);
  const hasErrors = photos.some(p => p.error);
  const canAddMore = photos.length < MAX_PHOTOS;

  const clear = useCallback(() => {
    photos.forEach(p => {
      if (p.localUrl) URL.revokeObjectURL(p.localUrl);
    });
    setPhotos([]);
  }, [photos]);

  return {
    photos,
    addPhotos,
    removePhoto,
    retryUpload,
    getUrls,
    isUploading,
    hasErrors,
    canAddMore,
    clear,
    maxPhotos: MAX_PHOTOS,
  };
}
