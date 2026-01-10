/**
 * Client-side thumbnail generation using Canvas API
 * Generates WebP thumbnails at 150/400/800px widths
 */

export interface GeneratedThumbnails {
  sm: Blob; // 150px
  md: Blob; // 400px
  lg: Blob; // 800px
  blurhash: string;
  width: number;
  height: number;
}

const THUMBNAIL_SIZES = {
  sm: 150,
  md: 400,
  lg: 800,
} as const;

/**
 * Generate thumbnails and blurhash from an image file
 */
export async function generateThumbnails(file: File): Promise<GeneratedThumbnails> {
  // Create image bitmap from file
  const img = await createImageBitmap(file);
  
  const thumbnails: Record<string, Blob> = {};
  
  // Generate thumbnails for each size
  for (const [size, targetWidth] of Object.entries(THUMBNAIL_SIZES)) {
    const blob = await resizeImage(img, targetWidth);
    thumbnails[size] = blob;
  }
  
  // Generate blurhash from small thumbnail (faster)
  const blurhash = await generateBlurhash(img);
  
  return {
    sm: thumbnails.sm,
    md: thumbnails.md,
    lg: thumbnails.lg,
    blurhash,
    width: img.width,
    height: img.height,
  };
}

/**
 * Resize image to target width maintaining aspect ratio
 */
async function resizeImage(img: ImageBitmap, targetWidth: number): Promise<Blob> {
  // Don't upscale
  const width = Math.min(img.width, targetWidth);
  const scale = width / img.width;
  const height = Math.round(img.height * scale);
  
  // Create offscreen canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Enable high-quality downsampling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw resized image
  ctx.drawImage(img, 0, 0, width, height);
  
  // Convert to WebP blob
  const blob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.85,
  });
  
  return blob;
}

/**
 * Generate blurhash from image
 * Uses dynamic import to lazy-load the blurhash library
 */
async function generateBlurhash(img: ImageBitmap): Promise<string> {
  // Import blurhash dynamically
  const { encode } = await import('blurhash');
  
  // Create small canvas for blurhash (32x32 is enough)
  const size = 32;
  const scale = size / Math.max(img.width, img.height);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);
  
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    return ''; // Return empty string if canvas fails
  }
  
  ctx.drawImage(img, 0, 0, width, height);
  
  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  
  // Generate blurhash with 4x3 components (good balance of size/quality)
  const hash = encode(imageData.data, width, height, 4, 3);
  
  return hash;
}

/**
 * Decode blurhash to a data URL for display
 */
export async function decodeBlurhash(
  hash: string,
  width = 32,
  height = 32
): Promise<string> {
  if (!hash) return '';
  
  try {
    const { decode } = await import('blurhash');
    
    const pixels = decode(hash, width, height);
    
    // Create canvas and draw pixels
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to decode blurhash:', error);
    return '';
  }
}
