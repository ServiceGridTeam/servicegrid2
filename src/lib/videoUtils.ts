/**
 * Video utilities for recording, thumbnail extraction, and duration calculation
 */

export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
}

/**
 * Extract metadata from a video file
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Video metadata extraction timeout'));
    }, 10000);
    
    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const metadata: VideoMetadata = {
        duration: Math.round(video.duration),
        width: video.videoWidth,
        height: video.videoHeight,
      };
      URL.revokeObjectURL(video.src);
      resolve(metadata);
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Extract first frame thumbnail from a video file
 * Returns a JPEG blob
 */
export async function extractVideoThumbnail(
  file: File,
  options: { width?: number; quality?: number } = {}
): Promise<Blob> {
  const { width = 400, quality = 0.85 } = options;
  
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Video thumbnail extraction timeout'));
    }, 15000);
    
    video.onloadeddata = async () => {
      try {
        // Seek to first frame
        video.currentTime = 0.1;
      } catch (e) {
        clearTimeout(timeout);
        URL.revokeObjectURL(video.src);
        reject(e);
      }
    };
    
    video.onseeked = () => {
      clearTimeout(timeout);
      
      try {
        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = video.videoHeight / video.videoWidth;
        const height = Math.round(width * aspectRatio);
        
        // Create canvas and draw frame
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(video.src);
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          },
          'image/jpeg',
          quality
        );
      } catch (e) {
        URL.revokeObjectURL(video.src);
        reject(e);
      }
    };
    
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video for thumbnail'));
    };
    
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Format duration in seconds to MM:SS string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get the best supported video MIME type for recording
 */
export function getSupportedVideoMimeType(): string {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  
  // Fallback
  return 'video/webm';
}

/**
 * Check if browser supports video recording
 */
export function isVideoRecordingSupported(): boolean {
  return !!(
    navigator.mediaDevices?.getUserMedia &&
    window.MediaRecorder
  );
}
