/**
 * Client-side photo watermarking using Canvas API
 * Applies business logo as a semi-transparent overlay
 */

export type WatermarkPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface WatermarkOptions {
  logoUrl: string;
  position: WatermarkPosition;
  opacity?: number; // 0-1, default 0.7
  sizePercent?: number; // Logo width as % of image width, default 10
  margin?: number; // Pixels from edge, default 16
}

/**
 * Apply a logo watermark to an image
 * 
 * @param imageBlob - The original image as a Blob
 * @param options - Watermark configuration
 * @returns Watermarked image as a Blob
 */
export async function applyWatermark(
  imageBlob: Blob,
  options: WatermarkOptions
): Promise<Blob> {
  const {
    logoUrl,
    position,
    opacity = 0.7,
    sizePercent = 10,
    margin = 16,
  } = options;

  // Load the source image
  const sourceImage = await loadImage(imageBlob);
  
  // Load the logo
  let logoImage: HTMLImageElement | null = null;
  try {
    logoImage = await loadImageFromUrl(logoUrl);
  } catch (error) {
    console.warn('Failed to load watermark logo, returning original image:', error);
    return imageBlob;
  }

  if (!logoImage) {
    return imageBlob;
  }

  // Create canvas with source image dimensions
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return imageBlob;
  }

  // Draw the source image
  ctx.drawImage(sourceImage, 0, 0);

  // Calculate logo size (maintaining aspect ratio)
  const logoWidth = Math.round(sourceImage.width * (sizePercent / 100));
  const logoAspect = logoImage.height / logoImage.width;
  const logoHeight = Math.round(logoWidth * logoAspect);

  // Calculate logo position based on selected corner
  let x: number, y: number;
  
  switch (position) {
    case 'top-left':
      x = margin;
      y = margin;
      break;
    case 'top-right':
      x = sourceImage.width - logoWidth - margin;
      y = margin;
      break;
    case 'bottom-left':
      x = margin;
      y = sourceImage.height - logoHeight - margin;
      break;
    case 'bottom-right':
    default:
      x = sourceImage.width - logoWidth - margin;
      y = sourceImage.height - logoHeight - margin;
      break;
  }

  // Draw logo with opacity
  ctx.globalAlpha = opacity;
  ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
  ctx.globalAlpha = 1.0;

  // Convert canvas to blob (using original image type)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create watermarked image'));
        }
      },
      imageBlob.type,
      0.92 // Quality
    );
  });
}

/**
 * Load an image from a Blob
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };
    
    img.src = url;
  });
}

/**
 * Load an image from a URL (with CORS support)
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for logo loading
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from URL: ${url}`));
    
    img.src = url;
  });
}

/**
 * Check if watermarking should be applied based on settings
 */
export function shouldApplyWatermark(
  autoWatermark: boolean,
  logoUrl: string | null | undefined
): boolean {
  return autoWatermark && !!logoUrl && logoUrl.trim().length > 0;
}
