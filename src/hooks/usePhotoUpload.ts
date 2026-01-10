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
  scanStatus?: 'pending' | 'scanning' | 'clean' | 'rejected'; // For customer uploads with quarantine flow
  uploadId?: string; // customer_media_uploads record ID
}

const MAX_PHOTOS = 5;
const SCAN_POLL_INTERVAL = 1000; // 1 second
const SCAN_TIMEOUT = 30000; // 30 seconds
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
  const isScanning = photos.some(p => p.scanStatus === 'scanning' || p.scanStatus === 'pending');
  const canAddMore = photos.length < MAX_PHOTOS;

  // Poll for scan status on photos that are scanning
  useEffect(() => {
    const scanningPhotos = photos.filter(p => p.uploadId && (p.scanStatus === 'scanning' || p.scanStatus === 'pending'));
    if (scanningPhotos.length === 0) return;

    const pollScanStatus = async () => {
      for (const photo of scanningPhotos) {
        if (!photo.uploadId) continue;

        try {
          const { data, error } = await supabase
            .from('customer_media_uploads')
            .select('scan_status, rejection_reason, storage_path, storage_bucket')
            .eq('id', photo.uploadId)
            .single();

          if (error) {
            console.error('Failed to check scan status:', error);
            continue;
          }

          if (data.scan_status === 'clean') {
            const { data: urlData } = supabase.storage
              .from(data.storage_bucket)
              .getPublicUrl(data.storage_path);

            setPhotos(prev => prev.map(p =>
              p.id === photo.id
                ? { ...p, scanStatus: 'clean', serverUrl: urlData.publicUrl, progress: 100 }
                : p
            ));
          } else if (data.scan_status === 'rejected') {
            setPhotos(prev => prev.map(p =>
              p.id === photo.id
                ? { ...p, scanStatus: 'rejected', error: data.rejection_reason || 'File rejected', progress: 0 }
                : p
            ));
          }
        } catch (err) {
          console.error('Error polling scan status:', err);
        }
      }
    };

    const intervalId = setInterval(pollScanStatus, SCAN_POLL_INTERVAL);
    
    // Set up timeout for scanning photos
    const timeoutIds = scanningPhotos.map(photo => {
      return setTimeout(() => {
        setPhotos(prev => prev.map(p =>
          p.id === photo.id && (p.scanStatus === 'scanning' || p.scanStatus === 'pending')
            ? { ...p, scanStatus: 'rejected', error: 'Scan timeout', progress: 0 }
            : p
        ));
      }, SCAN_TIMEOUT);
    });

    return () => {
      clearInterval(intervalId);
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [photos]);

  const clear = useCallback(() => {
    photos.forEach(p => {
      if (p.localUrl) URL.revokeObjectURL(p.localUrl);
    });
    setPhotos([]);
  }, [photos]);

  // Method to add a photo with quarantine flow (for customer uploads)
  const addPhotoWithQuarantine = useCallback((
    photoId: string,
    file: File,
    localUrl: string,
    uploadId: string
  ) => {
    const newPhoto: UploadingPhoto = {
      id: photoId,
      file,
      localUrl,
      serverUrl: null,
      progress: 50,
      error: null,
      scanStatus: 'scanning',
      uploadId,
    };
    setPhotos(prev => [...prev, newPhoto].slice(0, MAX_PHOTOS));
  }, []);

  return {
    photos,
    addPhotos,
    addPhotoWithQuarantine,
    removePhoto,
    retryUpload,
    getUrls,
    isUploading,
    hasErrors,
    hasQueued,
    isScanning,
    canAddMore,
    clear,
    maxPhotos: MAX_PHOTOS,
    isOnline,
  };
}
