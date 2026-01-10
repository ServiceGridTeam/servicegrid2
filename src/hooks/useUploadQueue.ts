import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  QueuedUpload,
  openDatabase,
  addToQueue,
  getQueuedItems,
  getQueuedItem,
  updateQueueItem,
  updateAttemptCount,
  removeFromQueue,
  getQueueStatus,
  clearFailedItems,
  retryFailedItems,
  dispatchQueueUpdate,
} from '@/lib/indexedDbQueue';
import type { MediaCategory } from '@/hooks/useJobMedia';
import { useQueryClient } from '@tanstack/react-query';

const MAX_CONCURRENT_UPLOADS = 3;
const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 300000; // 5 minutes

interface QueueStatus {
  itemCount: number;
  totalSize: number;
  pendingCount: number;
  uploadingCount: number;
  failedCount: number;
  isProcessing: boolean;
}

export function useUploadQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<QueueStatus>({
    itemCount: 0,
    totalSize: 0,
    pendingCount: 0,
    uploadingCount: 0,
    failedCount: 0,
    isProcessing: false,
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const processingRef = useRef(false);
  const activeUploadsRef = useRef(0);

  // Initialize database and load status
  useEffect(() => {
    const init = async () => {
      await openDatabase();
      await refreshStatus();
    };
    init();
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      dispatchQueueUpdate({ pending: status.pendingCount, status: 'offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [status.pendingCount]);

  // Warn before page unload if queue not empty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status.pendingCount > 0 || status.uploadingCount > 0) {
        e.preventDefault();
        e.returnValue = 'You have photos waiting to upload. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status.pendingCount, status.uploadingCount]);

  const refreshStatus = useCallback(async () => {
    const queueStatus = await getQueueStatus();
    setStatus(prev => ({ ...prev, ...queueStatus }));
    
    // Dispatch event for OfflineSyncIndicator
    let syncStatus: 'synced' | 'syncing' | 'pending' | 'offline' | 'error' = 'synced';
    if (!navigator.onLine) {
      syncStatus = 'offline';
    } else if (queueStatus.uploadingCount > 0) {
      syncStatus = 'syncing';
    } else if (queueStatus.failedCount > 0) {
      syncStatus = 'error';
    } else if (queueStatus.pendingCount > 0) {
      syncStatus = 'pending';
    }
    
    dispatchQueueUpdate({ 
      pending: queueStatus.pendingCount + queueStatus.uploadingCount, 
      status: syncStatus 
    });
  }, []);

  const queueUpload = useCallback(async (params: {
    file: File;
    jobId: string;
    category: MediaCategory;
    description?: string;
    customerId?: string;
    exifData?: QueuedUpload['exifData'];
    gpsPosition?: QueuedUpload['gpsPosition'];
  }): Promise<{ success: boolean; localPreviewUrl?: string; error?: string }> => {
    const { file, jobId, category, description, customerId, exifData, gpsPosition } = params;
    
    const upload: QueuedUpload = {
      id: crypto.randomUUID(),
      jobId,
      customerId,
      category,
      description,
      fileBlob: file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      exifData,
      gpsPosition,
      queuedAt: new Date().toISOString(),
      attemptCount: 0,
      status: 'pending',
      localPreviewUrl: URL.createObjectURL(file),
    };

    const result = await addToQueue(upload);
    
    if (!result.success) {
      toast({
        title: 'Queue Full',
        description: result.error,
        variant: 'destructive',
      });
      return { success: false, error: result.error };
    }

    if (result.warning) {
      toast({
        title: 'Queue Almost Full',
        description: result.warning,
        variant: 'default',
      });
    }

    await refreshStatus();
    
    // Start processing if online
    if (navigator.onLine) {
      processQueue();
    }

    return { success: true, localPreviewUrl: upload.localPreviewUrl };
  }, [toast, refreshStatus]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || !navigator.onLine) return;
    
    processingRef.current = true;
    setStatus(prev => ({ ...prev, isProcessing: true }));

    try {
      while (true) {
        // Get pending items
        const pendingItems = await getQueuedItems('pending');
        if (pendingItems.length === 0) break;
        
        // Check if we can start more uploads
        if (activeUploadsRef.current >= MAX_CONCURRENT_UPLOADS) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Get oldest pending item
        const item = pendingItems[0];
        await uploadItem(item);
      }
    } finally {
      processingRef.current = false;
      setStatus(prev => ({ ...prev, isProcessing: false }));
      await refreshStatus();
    }
  }, [refreshStatus]);

  const uploadItem = async (item: QueuedUpload) => {
    activeUploadsRef.current++;
    
    try {
      await updateQueueItem(item.id, { status: 'uploading' });
      await refreshStatus();

      // Get current user and business
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('active_business_id')
        .eq('id', user.id)
        .single();

      if (!profile?.active_business_id) throw new Error('No active business');

      // Upload to Supabase storage
      const fileExt = item.fileName.split('.').pop();
      const fileName = `${Date.now()}-${item.id}.${fileExt}`;
      const filePath = `${item.jobId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('job-media')
        .upload(filePath, item.fileBlob);

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('job-media')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedError) throw signedError;

      // Insert into job_media table
      const insertData = {
        business_id: profile.active_business_id,
        job_id: item.jobId,
        url: signedData.signedUrl,
        storage_path: filePath,
        storage_bucket: 'job-media',
        file_size_bytes: item.fileSize,
        mime_type: item.mimeType,
        media_type: item.mimeType.startsWith('video/') ? 'video' : 'image',
        category: item.category,
        description: item.description,
        status: 'processing' as const,
        captured_at: item.exifData?.captured_at,
        camera_make: item.exifData?.device_make,
        camera_model: item.exifData?.device_model,
        latitude: item.gpsPosition?.latitude || item.exifData?.gps_latitude,
        longitude: item.gpsPosition?.longitude || item.exifData?.gps_longitude,
      };

      const { data: mediaRecord, error: insertError } = await supabase
        .from('job_media')
        .insert(insertData as any)
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger thumbnail processing
      supabase.functions.invoke('process-photo-upload', {
        body: {
          media_id: mediaRecord.id,
          storage_path: filePath,
          bucket: 'job-media',
        },
      }).catch(err => console.error('Thumbnail processing error:', err));

      // Success - remove from queue
      await removeFromQueue(item.id);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['job-media', item.jobId] });
      
      toast({
        title: 'Photo uploaded',
        description: `${item.fileName} uploaded successfully`,
      });
    } catch (error) {
      console.error('Queue upload error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      await updateAttemptCount(item.id, errorMessage);
      
      const updatedItem = await getQueuedItem(item.id);
      
      if (updatedItem && updatedItem.attemptCount >= MAX_RETRY_ATTEMPTS) {
        toast({
          title: 'Upload failed permanently',
          description: `${item.fileName} failed after ${MAX_RETRY_ATTEMPTS} attempts`,
          variant: 'destructive',
        });
      } else {
        // Schedule retry with exponential backoff
        const delay = Math.min(
          BASE_RETRY_DELAY * Math.pow(2, updatedItem?.attemptCount || 0),
          MAX_RETRY_DELAY
        );
        setTimeout(() => processQueue(), delay);
      }
    } finally {
      activeUploadsRef.current--;
      await refreshStatus();
    }
  };

  const handleClearFailed = useCallback(async () => {
    const count = await clearFailedItems();
    await refreshStatus();
    toast({
      title: 'Failed items cleared',
      description: `Removed ${count} failed upload${count !== 1 ? 's' : ''}`,
    });
  }, [toast, refreshStatus]);

  const handleRetryFailed = useCallback(async () => {
    await retryFailedItems();
    await refreshStatus();
    processQueue();
    toast({
      title: 'Retrying failed uploads',
      description: 'Failed uploads have been queued for retry',
    });
  }, [toast, refreshStatus, processQueue]);

  return {
    status,
    isOnline,
    queueUpload,
    processQueue,
    clearFailed: handleClearFailed,
    retryFailed: handleRetryFailed,
    refreshStatus,
  };
}
