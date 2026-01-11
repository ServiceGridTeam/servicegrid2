/**
 * useAttachmentUpload hook
 * Handles file uploads to message-attachments storage bucket with progress tracking
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { getFileType, formatFileSize, type Attachment } from '@/lib/messageUtils';
import { toast } from 'sonner';

interface UploadProgress {
  [fileId: string]: number;
}

interface UseAttachmentUploadReturn {
  uploadAttachments: (files: File[], conversationId: string) => Promise<Attachment[]>;
  isUploading: boolean;
  progress: UploadProgress;
  error: Error | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

/**
 * Generate a unique filename to avoid collisions
 */
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '').substring(0, 50);
  return `${baseName}-${timestamp}-${random}.${extension}`;
}

/**
 * Create a thumbnail for image files
 */
async function createImageThumbnail(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(undefined);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

export function useAttachmentUpload(): UseAttachmentUploadReturn {
  const { activeBusinessId } = useBusinessContext();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({});
  const [error, setError] = useState<Error | null>(null);

  const uploadAttachments = useCallback(
    async (files: File[], conversationId: string): Promise<Attachment[]> => {
      if (!activeBusinessId) {
        throw new Error('No active business');
      }

      // Validate files
      const validFiles: File[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} is too large (max ${formatFileSize(MAX_FILE_SIZE)})`);
          continue;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`${file.name} has an unsupported file type`);
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        return [];
      }

      setIsUploading(true);
      setError(null);
      
      // Initialize progress for all files
      const initialProgress: UploadProgress = {};
      validFiles.forEach((file, index) => {
        initialProgress[`file-${index}`] = 0;
      });
      setProgress(initialProgress);

      const uploadedAttachments: Attachment[] = [];

      try {
        await Promise.all(
          validFiles.map(async (file, index) => {
            const fileId = `file-${index}`;
            const uniqueFileName = generateUniqueFileName(file.name);
            const storagePath = `${activeBusinessId}/conversations/${conversationId}/${uniqueFileName}`;

            // Create thumbnail for images
            const thumbnailDataUrl = await createImageThumbnail(file);

            // Update progress (simulated since Supabase doesn't provide upload progress)
            setProgress((prev) => ({ ...prev, [fileId]: 30 }));

            // Upload to storage
            const { error: uploadError } = await supabase.storage
              .from('message-attachments')
              .upload(storagePath, file, {
                cacheControl: '3600',
                upsert: false,
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
            }

            setProgress((prev) => ({ ...prev, [fileId]: 80 }));

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('message-attachments')
              .getPublicUrl(storagePath);

            setProgress((prev) => ({ ...prev, [fileId]: 100 }));

            const attachment: Attachment = {
              id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: file.name,
              url: urlData.publicUrl,
              type: getFileType(file.type),
              mimeType: file.type,
              size: file.size,
              thumbnailUrl: thumbnailDataUrl,
              processingStatus: 'ready',
            };

            uploadedAttachments.push(attachment);
          })
        );

        return uploadedAttachments;
      } catch (err) {
        const uploadError = err instanceof Error ? err : new Error('Upload failed');
        setError(uploadError);
        toast.error(uploadError.message);
        return uploadedAttachments; // Return any successfully uploaded files
      } finally {
        setIsUploading(false);
        // Clear progress after a short delay
        setTimeout(() => setProgress({}), 500);
      }
    },
    [activeBusinessId]
  );

  return {
    uploadAttachments,
    isUploading,
    progress,
    error,
  };
}
