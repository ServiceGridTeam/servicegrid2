import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScanRequest {
  upload_id: string;
  storage_path: string;
}

// Magic bytes for common image formats
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (WebP starts with RIFF)
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a or GIF89a
  'image/heic': [[0x00, 0x00, 0x00]], // ftyp container (partial match, needs further validation)
  'image/heif': [[0x00, 0x00, 0x00]], // ftyp container
};

// Maximum allowed dimensions
const MAX_DIMENSION = 8192;

// Validate magic bytes match the claimed mime type
function validateMagicBytes(data: Uint8Array, claimedMimeType: string): boolean {
  const expectedPatterns = MAGIC_BYTES[claimedMimeType];
  if (!expectedPatterns) {
    // Unknown type, allow if it's an image/* type
    return claimedMimeType.startsWith('image/');
  }

  for (const pattern of expectedPatterns) {
    let matches = true;
    for (let i = 0; i < pattern.length && i < data.length; i++) {
      if (data[i] !== pattern[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  
  return false;
}

// Simple dimension extraction for JPEG
function getJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  let offset = 2; // Skip SOI marker
  
  while (offset < data.length - 8) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = data[offset + 1];
    
    // SOF markers (Start of Frame)
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      return { width, height };
    }
    
    // Skip to next marker
    const length = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + length;
  }
  
  return null;
}

// Simple dimension extraction for PNG
function getPngDimensions(data: Uint8Array): { width: number; height: number } | null {
  // PNG IHDR chunk starts at offset 8
  if (data.length < 24) return null;
  
  // Check for IHDR chunk type
  if (data[12] === 0x49 && data[13] === 0x48 && data[14] === 0x44 && data[15] === 0x52) {
    const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
    return { width, height };
  }
  
  return null;
}

// Get image dimensions based on mime type
function getImageDimensions(data: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/jpeg') {
    return getJpegDimensions(data);
  }
  if (mimeType === 'image/png') {
    return getPngDimensions(data);
  }
  // For other formats, skip dimension check (would need format-specific parsers)
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('scan-customer-upload: Starting');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { upload_id, storage_path }: ScanRequest = await req.json();
    
    console.log(`scan-customer-upload: Processing upload_id=${upload_id}, path=${storage_path}`);

    if (!upload_id || !storage_path) {
      throw new Error('Missing required fields: upload_id, storage_path');
    }

    // Get upload record to check mime type
    const { data: uploadRecord, error: fetchError } = await supabaseAdmin
      .from('customer_media_uploads')
      .select('*')
      .eq('id', upload_id)
      .single();

    if (fetchError || !uploadRecord) {
      console.error('scan-customer-upload: Failed to fetch upload record', fetchError);
      throw new Error(`Upload record not found: ${fetchError?.message}`);
    }

    const claimedMimeType = uploadRecord.mime_type;
    console.log(`scan-customer-upload: Claimed mime type: ${claimedMimeType}`);

    // Download file from quarantine bucket
    console.log('scan-customer-upload: Downloading from quarantine');
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('customer-uploads-quarantine')
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error('scan-customer-upload: Download failed', downloadError);
      await updateScanStatus(supabaseAdmin, upload_id, 'rejected', 'File not found in quarantine');
      throw new Error(`Failed to download: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`scan-customer-upload: Downloaded ${uint8Array.length} bytes`);

    // Validation 1: Magic bytes check
    if (!validateMagicBytes(uint8Array, claimedMimeType)) {
      console.error('scan-customer-upload: Magic bytes validation failed');
      await updateScanStatus(supabaseAdmin, upload_id, 'rejected', 'File type mismatch - magic bytes do not match claimed type');
      await deleteFromQuarantine(supabaseAdmin, storage_path);
      return errorResponse('File type validation failed');
    }

    console.log('scan-customer-upload: Magic bytes validated');

    // Validation 2: Dimension check
    const dimensions = getImageDimensions(uint8Array, claimedMimeType);
    if (dimensions) {
      console.log(`scan-customer-upload: Dimensions: ${dimensions.width}x${dimensions.height}`);
      if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
        console.error('scan-customer-upload: Dimension validation failed');
        await updateScanStatus(supabaseAdmin, upload_id, 'rejected', `Image too large: ${dimensions.width}x${dimensions.height}, max ${MAX_DIMENSION}x${MAX_DIMENSION}`);
        await deleteFromQuarantine(supabaseAdmin, storage_path);
        return errorResponse('Image dimensions exceed maximum allowed');
      }
    } else {
      console.log('scan-customer-upload: Could not extract dimensions, skipping dimension check');
    }

    // Validation 3: Basic file integrity check (ensure it's not empty or truncated)
    if (uint8Array.length < 100) {
      console.error('scan-customer-upload: File too small, likely corrupted');
      await updateScanStatus(supabaseAdmin, upload_id, 'rejected', 'File too small or corrupted');
      await deleteFromQuarantine(supabaseAdmin, storage_path);
      return errorResponse('File appears to be corrupted');
    }

    // All validations passed - move file to production bucket
    console.log('scan-customer-upload: Validations passed, moving to production bucket');
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('customer-uploads')
      .upload(storage_path, uint8Array, {
        contentType: claimedMimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('scan-customer-upload: Failed to upload to production', uploadError);
      await updateScanStatus(supabaseAdmin, upload_id, 'rejected', `Failed to move to production: ${uploadError.message}`);
      return errorResponse('Failed to process file');
    }

    // Get public URL for the moved file
    const { data: urlData } = supabaseAdmin.storage
      .from('customer-uploads')
      .getPublicUrl(storage_path);

    // Update record with scan results
    const scanResult = {
      magic_bytes_valid: true,
      dimensions: dimensions || null,
      file_size: uint8Array.length,
      scanned_at: new Date().toISOString(),
    };

    await supabaseAdmin
      .from('customer_media_uploads')
      .update({
        scan_status: 'clean',
        scan_result: scanResult,
        scan_completed_at: new Date().toISOString(),
        storage_bucket: 'customer-uploads', // Update to production bucket
      })
      .eq('id', upload_id);

    // Delete from quarantine
    await deleteFromQuarantine(supabaseAdmin, storage_path);

    console.log('scan-customer-upload: Successfully processed and moved file');

    return new Response(
      JSON.stringify({
        success: true,
        upload_id,
        status: 'clean',
        public_url: urlData.publicUrl,
        dimensions,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('scan-customer-upload: Error', error);
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

async function updateScanStatus(
  supabase: any,
  uploadId: string,
  status: 'pending' | 'clean' | 'rejected',
  rejectionReason?: string
) {
  await supabase
    .from('customer_media_uploads')
    .update({
      scan_status: status,
      scan_completed_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
    })
    .eq('id', uploadId);
}

async function deleteFromQuarantine(
  supabase: any,
  storagePath: string
) {
  const { error } = await supabase.storage
    .from('customer-uploads-quarantine')
    .remove([storagePath]);
  
  if (error) {
    console.error('scan-customer-upload: Failed to delete from quarantine', error);
  }
}

function errorResponse(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    }
  );
}
