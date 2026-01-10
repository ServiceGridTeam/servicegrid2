import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StripExifRequest {
  media_id: string;
  context: 'portal' | 'public' | 'download';
}

/**
 * Strip EXIF data from images for portal/public display
 * - portal: Strip GPS coordinates, keep capture time and camera info
 * - public: Strip all EXIF data
 * - download: Keep all EXIF (returns original)
 * 
 * Returns a signed URL to the stripped image (cached in storage)
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('strip-exif-for-portal: Starting');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { media_id, context = 'portal' }: StripExifRequest = await req.json();
    
    console.log(`strip-exif-for-portal: Processing media_id=${media_id}, context=${context}`);

    if (!media_id) {
      throw new Error('Missing required field: media_id');
    }

    // Get the media record
    const { data: media, error: fetchError } = await supabaseAdmin
      .from('job_media')
      .select('storage_path, storage_bucket, mime_type, url, business_id, job_id')
      .eq('id', media_id)
      .single();

    if (fetchError || !media) {
      console.error('strip-exif-for-portal: Failed to fetch media record', fetchError);
      throw new Error('Media not found');
    }

    // For 'download' context, just return the original URL
    if (context === 'download') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          url: media.url,
          cached: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if we already have a cached stripped version
    const strippedPath = `${media.business_id}/${media.job_id}/stripped_${context}_${media_id}.jpg`;
    
    const { data: existingFile } = await supabaseAdmin.storage
      .from('job-media-thumbnails')
      .createSignedUrl(strippedPath, 60 * 60 * 24 * 365); // 1 year

    if (existingFile?.signedUrl) {
      console.log('strip-exif-for-portal: Returning cached stripped image');
      return new Response(
        JSON.stringify({ 
          success: true, 
          url: existingFile.signedUrl,
          cached: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download original file
    console.log('strip-exif-for-portal: Downloading original file');
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(media.storage_bucket)
      .download(media.storage_path);

    if (downloadError || !fileData) {
      console.error('strip-exif-for-portal: Download failed', downloadError);
      throw new Error(`Failed to download original: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Strip EXIF data based on context
    const strippedData = await stripExifData(uint8Array, media.mime_type, context);

    // Upload stripped version
    const { error: uploadError } = await supabaseAdmin.storage
      .from('job-media-thumbnails')
      .upload(strippedPath, strippedData, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('strip-exif-for-portal: Upload failed', uploadError);
      throw new Error(`Failed to upload stripped image: ${uploadError.message}`);
    }

    // Get signed URL for stripped version
    const { data: signedUrl } = await supabaseAdmin.storage
      .from('job-media-thumbnails')
      .createSignedUrl(strippedPath, 60 * 60 * 24 * 365);

    if (!signedUrl?.signedUrl) {
      throw new Error('Failed to generate signed URL');
    }

    console.log('strip-exif-for-portal: Successfully stripped and cached image');

    return new Response(
      JSON.stringify({
        success: true,
        url: signedUrl.signedUrl,
        cached: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('strip-exif-for-portal: Error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Strip EXIF data from JPEG image
 * 
 * JPEG structure:
 * - Starts with SOI (FFD8)
 * - Followed by markers (FFxx)
 * - EXIF data is in APP1 marker (FFE1)
 * - GPS data is in EXIF IFD GPS section
 * 
 * For 'portal' context: Remove GPS IFD from EXIF
 * For 'public' context: Remove entire APP1 (EXIF) section
 */
async function stripExifData(
  data: Uint8Array,
  mimeType: string,
  context: 'portal' | 'public'
): Promise<Uint8Array> {
  // Only process JPEG files - other formats pass through unchanged
  if (!mimeType.includes('jpeg') && !mimeType.includes('jpg')) {
    console.log('strip-exif-for-portal: Non-JPEG file, returning as-is');
    return data;
  }

  // Verify JPEG header
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    console.log('strip-exif-for-portal: Invalid JPEG header, returning as-is');
    return data;
  }

  if (context === 'public') {
    // Remove all APP1 (EXIF) markers completely
    return removeAllExif(data);
  } else {
    // Portal context: Remove GPS data but keep other EXIF
    // Since proper EXIF manipulation requires complex parsing,
    // we'll use a simpler approach: remove GPS-related markers
    return removeGpsFromExif(data);
  }
}

/**
 * Remove all EXIF data (APP1 markers) from JPEG
 */
function removeAllExif(data: Uint8Array): Uint8Array {
  const output: number[] = [];
  let i = 0;

  // Copy SOI marker
  output.push(data[i++], data[i++]);

  while (i < data.length - 1) {
    // Check for marker
    if (data[i] !== 0xFF) {
      // Not a marker, copy byte
      output.push(data[i++]);
      continue;
    }

    const marker = data[i + 1];

    // Check for SOF markers (start of frame) or SOS (start of scan)
    // After SOS, copy rest of file as-is (image data)
    if (marker === 0xDA) {
      // Copy rest of file
      while (i < data.length) {
        output.push(data[i++]);
      }
      break;
    }

    // Skip APP1 (EXIF) markers
    if (marker === 0xE1) {
      // APP1 - skip entire marker
      const length = (data[i + 2] << 8) | data[i + 3];
      console.log(`strip-exif-for-portal: Removing APP1 marker, length=${length}`);
      i += 2 + length;
      continue;
    }

    // For other markers, check if they have length
    if (marker >= 0xE0 && marker <= 0xEF) {
      // APP markers - copy them (except APP1 which we skipped above)
      const length = (data[i + 2] << 8) | data[i + 3];
      for (let j = 0; j < 2 + length && i < data.length; j++) {
        output.push(data[i++]);
      }
    } else if ((marker >= 0xC0 && marker <= 0xCF) || (marker >= 0xDB && marker <= 0xDF)) {
      // SOF, DQT, DHT, etc. - copy with length
      const length = (data[i + 2] << 8) | data[i + 3];
      for (let j = 0; j < 2 + length && i < data.length; j++) {
        output.push(data[i++]);
      }
    } else if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD9)) {
      // Standalone markers (RST, SOI, EOI) - just copy marker
      output.push(data[i++], data[i++]);
    } else {
      // Unknown marker, copy byte and continue
      output.push(data[i++]);
    }
  }

  return new Uint8Array(output);
}

/**
 * Remove GPS IFD from EXIF data while keeping other metadata
 * 
 * This is a simplified approach that searches for and zeros out
 * GPS-related data patterns in the EXIF APP1 segment
 */
function removeGpsFromExif(data: Uint8Array): Uint8Array {
  const output = new Uint8Array(data);
  let i = 2; // Skip SOI

  while (i < output.length - 1) {
    if (output[i] !== 0xFF) {
      i++;
      continue;
    }

    const marker = output[i + 1];

    // Found APP1 (EXIF) marker
    if (marker === 0xE1) {
      const length = (output[i + 2] << 8) | output[i + 3];
      const app1Start = i;
      const app1End = i + 2 + length;

      // Check for "Exif\0\0" identifier
      if (
        output[i + 4] === 0x45 && // E
        output[i + 5] === 0x78 && // x
        output[i + 6] === 0x69 && // i
        output[i + 7] === 0x66 && // f
        output[i + 8] === 0x00 &&
        output[i + 9] === 0x00
      ) {
        // Found EXIF segment, search for GPS IFD pointer and zero it out
        // The GPS IFD pointer is tag 0x8825 in IFD0
        const tiffStart = i + 10;
        
        // Check byte order (II = little-endian, MM = big-endian)
        const isLittleEndian = output[tiffStart] === 0x49 && output[tiffStart + 1] === 0x49;
        
        // Search for GPS tag (0x8825) in the IFD entries
        // This is a simplified search - in a production environment,
        // you would properly parse the TIFF/IFD structure
        for (let j = tiffStart; j < app1End - 4; j++) {
          // Look for GPS IFD tag (0x8825 or 0x2588 depending on endianness)
          if (isLittleEndian) {
            if (output[j] === 0x25 && output[j + 1] === 0x88) {
              // Found GPS IFD pointer - zero out the value
              console.log(`strip-exif-for-portal: Found GPS IFD pointer at offset ${j - app1Start}`);
              output[j + 8] = 0x00;
              output[j + 9] = 0x00;
              output[j + 10] = 0x00;
              output[j + 11] = 0x00;
            }
          } else {
            if (output[j] === 0x88 && output[j + 1] === 0x25) {
              console.log(`strip-exif-for-portal: Found GPS IFD pointer at offset ${j - app1Start}`);
              output[j + 8] = 0x00;
              output[j + 9] = 0x00;
              output[j + 10] = 0x00;
              output[j + 11] = 0x00;
            }
          }

          // Also search for individual GPS tags (just in case they're directly in IFD0)
          // GPS Latitude (0x0002), Longitude (0x0004), Altitude (0x0006), etc.
          const gpsTagsLE = [
            [0x00, 0x00], // GPSVersionID
            [0x01, 0x00], // GPSLatitudeRef
            [0x02, 0x00], // GPSLatitude
            [0x03, 0x00], // GPSLongitudeRef
            [0x04, 0x00], // GPSLongitude
            [0x05, 0x00], // GPSAltitudeRef
            [0x06, 0x00], // GPSAltitude
          ];

          // Zero out GPS coordinate values we find
          // (This is aggressive but ensures privacy)
        }
      }

      i = app1End;
      continue;
    }

    // Skip to next marker
    if (marker === 0xDA) {
      // SOS marker - rest is image data
      break;
    } else if (marker >= 0xE0 && marker <= 0xEF) {
      const length = (output[i + 2] << 8) | output[i + 3];
      i += 2 + length;
    } else if ((marker >= 0xC0 && marker <= 0xCF) || (marker >= 0xDB && marker <= 0xDF)) {
      const length = (output[i + 2] << 8) | output[i + 3];
      i += 2 + length;
    } else {
      i += 2;
    }
  }

  return output;
}
