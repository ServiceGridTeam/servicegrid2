/**
 * HEIC/HEIF to JPEG converter utility
 * Handles iPhone/iPad HEIC photos and converts them to browser-compatible JPEG
 */

import heic2any from 'heic2any';

// HEIC/HEIF magic byte signatures
// HEIC files start with 'ftyp' followed by brand codes
const HEIC_BRANDS = [
  'heic', // Standard HEIC
  'heix', // HEIC with extensions
  'hevc', // HEVC video
  'hevx', // HEVC video with extensions
  'mif1', // HEIF image
  'msf1', // HEIF image sequence
];

/**
 * Detect if a file is HEIC/HEIF format by checking magic bytes
 * More reliable than checking file extension alone
 */
export async function isHeicFile(file: File): Promise<boolean> {
  // Quick extension check first
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'heic' || extension === 'heif') {
    return true;
  }

  // Check mime type
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    return true;
  }

  // Check magic bytes for more reliability
  try {
    const buffer = await file.slice(0, 12).arrayBuffer();
    const view = new Uint8Array(buffer);
    
    // HEIC files have 'ftyp' at offset 4
    // Check bytes 4-7 for 'ftyp'
    if (view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70) {
      // Get the brand code at offset 8-11
      const brand = String.fromCharCode(view[8], view[9], view[10], view[11]);
      return HEIC_BRANDS.includes(brand);
    }
    
    return false;
  } catch {
    // If we can't read magic bytes, fall back to extension check
    return false;
  }
}

/**
 * Convert HEIC/HEIF file to JPEG
 * Returns the converted File object ready for upload
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // heic2any returns a Blob or Blob[]
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92, // High quality to preserve details
    });

    // Handle both single blob and array of blobs
    const blob = Array.isArray(result) ? result[0] : result;

    // Create new filename with .jpg extension
    const originalName = file.name;
    const nameWithoutExtension = originalName.replace(/\.(heic|heif)$/i, '');
    const newName = `${nameWithoutExtension}.jpg`;

    // Create File object from Blob
    const convertedFile = new File([blob], newName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });

    return convertedFile;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error(`Failed to convert HEIC image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process a file, converting HEIC to JPEG if necessary
 * Returns the original file if not HEIC, or converted file if it was HEIC
 */
export async function processFileForUpload(file: File): Promise<{
  file: File;
  wasConverted: boolean;
}> {
  const isHeic = await isHeicFile(file);
  
  if (!isHeic) {
    return { file, wasConverted: false };
  }

  try {
    const convertedFile = await convertHeicToJpeg(file);
    return { file: convertedFile, wasConverted: true };
  } catch (error) {
    // If conversion fails, return original file
    // The server will handle it or mark as unsupported
    console.warn('HEIC conversion failed, using original file:', error);
    return { file, wasConverted: false };
  }
}
