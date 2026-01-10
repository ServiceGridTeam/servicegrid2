import exifr from 'exifr';

export interface ExtractedExifData {
  // GPS data
  latitude?: number;
  longitude?: number;
  altitude?: number;
  
  // Capture timestamp
  captured_at?: string;
  
  // Camera info
  camera_make?: string;
  camera_model?: string;
  
  // Exposure settings
  iso?: number;
  aperture?: string;
  shutter_speed?: string;
  focal_length?: string;
  
  // Image dimensions
  width?: number;
  height?: number;
  
  // Orientation (1-8, EXIF orientation tag)
  orientation?: number;
}

/**
 * Extracts EXIF metadata from an image file using exifr library.
 * Handles GPS coordinates, camera info, capture timestamp, and exposure settings.
 */
export async function extractExifData(file: File): Promise<ExtractedExifData | null> {
  try {
    // Use exifr to parse all relevant EXIF data
    // exifr auto-parses GPS, EXIF, and IFD0 segments by default
    const exif = await exifr.parse(file, [
      // GPS
      'latitude',
      'longitude',
      'GPSAltitude',
      
      // Timestamps
      'DateTimeOriginal',
      'CreateDate',
      'ModifyDate',
      
      // Camera
      'Make',
      'Model',
      
      // Exposure
      'ISO',
      'ISOSpeedRatings',
      'FNumber',
      'ExposureTime',
      'FocalLength',
      'FocalLengthIn35mmFormat',
      
      // Image
      'ImageWidth',
      'ImageHeight',
      'ExifImageWidth',
      'ExifImageHeight',
      'Orientation',
    ]);

    if (!exif) {
      console.log('No EXIF data found in image');
      return null;
    }

    // Format aperture as f-stop string
    const formatAperture = (fNumber: number | undefined): string | undefined => {
      if (!fNumber) return undefined;
      return `f/${fNumber}`;
    };

    // Format shutter speed as fraction or decimal
    const formatShutterSpeed = (exposureTime: number | undefined): string | undefined => {
      if (!exposureTime) return undefined;
      if (exposureTime >= 1) {
        return `${exposureTime}s`;
      }
      // Convert to fraction like 1/250
      const denominator = Math.round(1 / exposureTime);
      return `1/${denominator}s`;
    };

    // Format focal length
    const formatFocalLength = (fl: number | undefined): string | undefined => {
      if (!fl) return undefined;
      return `${Math.round(fl)}mm`;
    };

    // Get the best timestamp available
    const getTimestamp = (): string | undefined => {
      const timestamp = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
      if (!timestamp) return undefined;
      
      // exifr returns Date objects
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      
      // Handle string format if returned
      if (typeof timestamp === 'string') {
        // EXIF date format: "2024:01:15 14:30:00"
        const parsed = timestamp.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        return new Date(parsed).toISOString();
      }
      
      return undefined;
    };

    const result: ExtractedExifData = {
      // GPS - exifr auto-converts to decimal degrees
      latitude: exif.latitude,
      longitude: exif.longitude,
      altitude: exif.GPSAltitude,
      
      // Timestamp
      captured_at: getTimestamp(),
      
      // Camera
      camera_make: exif.Make,
      camera_model: exif.Model,
      
      // Exposure
      iso: exif.ISO || exif.ISOSpeedRatings,
      aperture: formatAperture(exif.FNumber),
      shutter_speed: formatShutterSpeed(exif.ExposureTime),
      focal_length: formatFocalLength(exif.FocalLength || exif.FocalLengthIn35mmFormat),
      
      // Dimensions
      width: exif.ImageWidth || exif.ExifImageWidth,
      height: exif.ImageHeight || exif.ExifImageHeight,
      
      // Orientation
      orientation: exif.Orientation,
    };

    // Filter out undefined values
    const cleanResult = Object.fromEntries(
      Object.entries(result).filter(([_, value]) => value !== undefined)
    ) as ExtractedExifData;

    console.log('Extracted EXIF data:', cleanResult);
    return cleanResult;
  } catch (error) {
    console.error('Failed to extract EXIF data:', error);
    return null;
  }
}

/**
 * Gets current GPS position with accuracy information.
 * Returns null if geolocation is not available or permission is denied.
 */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
} | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude ?? undefined,
        });
      },
      (error) => {
        console.log('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000, // Accept cached position up to 30 seconds old
      }
    );
  });
}
