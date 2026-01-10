import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { MediaCategory } from '@/hooks/useJobMedia';

export interface QueuedUpload {
  id: string;
  jobId: string;
  customerId?: string;
  category: MediaCategory;
  description?: string;
  fileBlob: Blob;
  fileName: string;
  mimeType: string;
  fileSize: number;
  exifData?: {
    captured_at?: string;
    device_make?: string;
    device_model?: string;
    gps_latitude?: number;
    gps_longitude?: number;
  };
  gpsPosition?: { latitude: number; longitude: number };
  queuedAt: string;
  attemptCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  status: 'pending' | 'uploading' | 'failed';
  localPreviewUrl?: string;
}

interface UploadQueueDB extends DBSchema {
  uploads: {
    key: string;
    value: QueuedUpload;
    indexes: {
      'by-status': string;
      'by-job': string;
      'by-queued': string;
    };
  };
}

const DB_NAME = 'servicegrid-upload-queue';
const DB_VERSION = 1;
const MAX_QUEUE_ITEMS = 100;
const MAX_QUEUE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const WARNING_THRESHOLD = 0.8; // 80%

let dbInstance: IDBPDatabase<UploadQueueDB> | null = null;

export async function openDatabase(): Promise<IDBPDatabase<UploadQueueDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<UploadQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('uploads', { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-job', 'jobId');
      store.createIndex('by-queued', 'queuedAt');
    },
  });

  return dbInstance;
}

export async function addToQueue(upload: QueuedUpload): Promise<{ success: boolean; warning?: string; error?: string }> {
  const db = await openDatabase();
  
  // Check capacity before adding
  const status = await getQueueStatus();
  
  if (status.itemCount >= MAX_QUEUE_ITEMS) {
    return { success: false, error: 'Queue is full (100 items). Please wait for uploads to complete or clear failed items.' };
  }
  
  if (status.totalSize + upload.fileSize > MAX_QUEUE_SIZE_BYTES) {
    return { success: false, error: 'Queue storage limit reached (500MB). Please wait for uploads to complete.' };
  }

  await db.add('uploads', upload);

  // Check if approaching capacity
  const newStatus = await getQueueStatus();
  const itemCapacity = newStatus.itemCount / MAX_QUEUE_ITEMS;
  const sizeCapacity = newStatus.totalSize / MAX_QUEUE_SIZE_BYTES;
  
  if (itemCapacity >= WARNING_THRESHOLD || sizeCapacity >= WARNING_THRESHOLD) {
    return { 
      success: true, 
      warning: `Queue is ${Math.round(Math.max(itemCapacity, sizeCapacity) * 100)}% full` 
    };
  }

  return { success: true };
}

export async function getQueuedItems(status?: QueuedUpload['status']): Promise<QueuedUpload[]> {
  const db = await openDatabase();
  
  if (status) {
    return db.getAllFromIndex('uploads', 'by-status', status);
  }
  
  // Get all items sorted by queuedAt (FIFO)
  const items = await db.getAllFromIndex('uploads', 'by-queued');
  return items;
}

export async function getQueuedItemsByJob(jobId: string): Promise<QueuedUpload[]> {
  const db = await openDatabase();
  return db.getAllFromIndex('uploads', 'by-job', jobId);
}

export async function getQueuedItem(id: string): Promise<QueuedUpload | undefined> {
  const db = await openDatabase();
  return db.get('uploads', id);
}

export async function updateQueueItem(id: string, updates: Partial<QueuedUpload>): Promise<void> {
  const db = await openDatabase();
  const item = await db.get('uploads', id);
  
  if (item) {
    await db.put('uploads', { ...item, ...updates });
  }
}

export async function updateAttemptCount(id: string, error?: string): Promise<void> {
  const db = await openDatabase();
  const item = await db.get('uploads', id);
  
  if (item) {
    await db.put('uploads', {
      ...item,
      attemptCount: item.attemptCount + 1,
      lastAttemptAt: new Date().toISOString(),
      lastError: error,
      status: item.attemptCount >= 9 ? 'failed' : 'pending', // Mark as failed after 10 attempts
    });
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDatabase();
  
  // Revoke the blob URL if exists
  const item = await db.get('uploads', id);
  if (item?.localPreviewUrl) {
    URL.revokeObjectURL(item.localPreviewUrl);
  }
  
  await db.delete('uploads', id);
}

export async function getQueueStatus(): Promise<{
  itemCount: number;
  totalSize: number;
  pendingCount: number;
  uploadingCount: number;
  failedCount: number;
}> {
  const db = await openDatabase();
  const items = await db.getAll('uploads');
  
  let totalSize = 0;
  let pendingCount = 0;
  let uploadingCount = 0;
  let failedCount = 0;
  
  for (const item of items) {
    totalSize += item.fileSize;
    if (item.status === 'pending') pendingCount++;
    else if (item.status === 'uploading') uploadingCount++;
    else if (item.status === 'failed') failedCount++;
  }
  
  return {
    itemCount: items.length,
    totalSize,
    pendingCount,
    uploadingCount,
    failedCount,
  };
}

export async function clearQueue(): Promise<void> {
  const db = await openDatabase();
  
  // Revoke all blob URLs first
  const items = await db.getAll('uploads');
  for (const item of items) {
    if (item.localPreviewUrl) {
      URL.revokeObjectURL(item.localPreviewUrl);
    }
  }
  
  await db.clear('uploads');
}

export async function clearFailedItems(): Promise<number> {
  const db = await openDatabase();
  const failedItems = await db.getAllFromIndex('uploads', 'by-status', 'failed');
  
  for (const item of failedItems) {
    if (item.localPreviewUrl) {
      URL.revokeObjectURL(item.localPreviewUrl);
    }
    await db.delete('uploads', item.id);
  }
  
  return failedItems.length;
}

export async function retryFailedItems(): Promise<void> {
  const db = await openDatabase();
  const failedItems = await db.getAllFromIndex('uploads', 'by-status', 'failed');
  
  for (const item of failedItems) {
    await db.put('uploads', {
      ...item,
      status: 'pending',
      attemptCount: 0,
      lastError: undefined,
    });
  }
}

// Dispatch custom event for OfflineSyncIndicator
export function dispatchQueueUpdate(status: { pending: number; status: 'synced' | 'syncing' | 'pending' | 'offline' | 'error' }) {
  window.dispatchEvent(new CustomEvent('upload-queue-update', { detail: status }));
}
