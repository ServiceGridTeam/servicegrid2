import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  getQueuedItemsByJob, 
  dispatchQueueUpdate,
  type QueuedUpload 
} from '@/lib/indexedDbQueue';

export interface UploadingPhoto {
  id: string;
  file: File;
  localUrl: string;
  serverUrl: string | null;
  progress: number;
  error: string | null;
  isQueued?: boolean; // True if stored in IndexedDB for offline upload
}

const MAX_PHOTOS = 5;

export function usePhotoUpload(jobId?: string) {
  const [photos, setPhotos] = useState<UploadingPhoto[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load queued photos for this job on mount
  useEffect(() => {
    const loadQueuedPhotos = async () => {
      if (!jobId) return;
      
      try {
        const queuedItems = await getQueuedItemsByJob(jobId);
        const queuedPhotos: UploadingPhoto[] = queuedItems.map(item => ({
          id: item.id,
          file: new File([item.fileBlob], item.fileName, { type: item.mimeType }),
          localUrl: item.localPreviewUrl || URL.createObjectURL(item.fileBlob),
          serverUrl: null,
          progress: item.status === 'uploading' ? 50 : 0,
          error: item.status === 'failed' ? item.lastError || 'Upload failed' : null,
          isQueued: true,
        }));
        
        if (queuedPhotos.length > 0) {
          setPhotos(prev => [...prev, ...queuedPhotos]);
        }
      } catch (err) {
        console.error('Failed to load queued photos:', err);
      }
    };

    loadQueuedPhotos();
  }, [jobId]);

  const addPhotos = useCallback(async (files: FileList | File[]) => {
    const newFiles = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    
    const newPhotos: UploadingPhoto[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      localUrl: URL.createObjectURL(file),
      serverUrl: null,
      progress: 0,
      error: null,
      isQueued: !isOnline, // Mark as queued if offline
    }));

    setPhotos(prev => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));

    // Upload each photo in background (or queue if offline)
    for (const photo of newPhotos) {
      if (isOnline) {
        uploadPhoto(photo);
      } else {
        // Photo will be handled by useUploadQueue when added via PhotoCaptureButton
        // Just update the progress indicator to show it's queued
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, progress: 0, isQueued: true } : p
        ));
        dispatchQueueUpdate({ pending: 1, status: 'offline' });
      }
    }
  }, [photos.length, isOnline]);

  const uploadPhoto = async (photo: UploadingPhoto) => {
    try {
      const fileExt = photo.file.name.split('.').pop();
      const fileName = `${Date.now()}-${photo.id}.${fileExt}`;
      const filePath = `service-requests/${fileName}`;

      // Update progress to indicate upload started
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, progress: 10, isQueued: false } : p
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
          ? { ...p, serverUrl: urlData.publicUrl, progress: 100, isQueued: false } 
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
        p.id === id ? { ...p, error: null, progress: 0, isQueued: false } : p
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
  const hasQueued = photos.some(p => p.isQueued);
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
    hasQueued,
    canAddMore,
    clear,
    maxPhotos: MAX_PHOTOS,
    isOnline,
  };
}
