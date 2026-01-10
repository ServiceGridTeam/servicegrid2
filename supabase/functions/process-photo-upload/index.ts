import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessPhotoRequest {
  media_id: string;
  storage_path: string;
  bucket: string;
}

// Thumbnail sizes in pixels (width)
const THUMBNAIL_SIZES = {
  sm: 150,
  md: 400,
  lg: 800,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('process-photo-upload: Starting');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for storage operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { media_id, storage_path, bucket }: ProcessPhotoRequest = await req.json();
    
    console.log(`process-photo-upload: Processing media_id=${media_id}, path=${storage_path}`);

    if (!media_id || !storage_path || !bucket) {
      throw new Error('Missing required fields: media_id, storage_path, bucket');
    }

    // Download original file
    console.log('process-photo-upload: Downloading original file');
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucket)
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error('process-photo-upload: Download failed', downloadError);
      throw new Error(`Failed to download original: ${downloadError?.message}`);
    }

    // Get file as array buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`process-photo-upload: Downloaded ${uint8Array.length} bytes`);

    // For now, we'll create "thumbnails" by just copying the original
    // In production, you'd use an image processing library like sharp or ImageMagick
    // Deno doesn't have native image processing, so we'd need to:
    // 1. Use a WebAssembly-based library
    // 2. Call an external image processing service
    // 3. Use a pre-built image processing edge function
    
    // For this implementation, we'll store the original as thumbnails
    // and track dimensions from the original image
    const thumbnailUrls: Record<string, string | null> = {
      sm: null,
      md: null,
      lg: null,
    };

    // Extract business_id and job_id from storage path
    // Format: {business_id}/{job_id}/{filename}
    const pathParts = storage_path.split('/');
    const businessId = pathParts[0];
    const jobId = pathParts[1];
    const originalFilename = pathParts[pathParts.length - 1];
    const baseFilename = originalFilename.replace(/\.[^.]+$/, '');

    // Generate thumbnail paths and upload
    for (const [size, _width] of Object.entries(THUMBNAIL_SIZES)) {
      const thumbnailPath = `${businessId}/${jobId}/thumb_${size}_${baseFilename}.webp`;
      
      console.log(`process-photo-upload: Uploading thumbnail ${size} to ${thumbnailPath}`);
      
      // Upload the file (using original for now - would be resized in production)
      const { error: uploadError } = await supabaseAdmin.storage
        .from('job-media-thumbnails')
        .upload(thumbnailPath, uint8Array, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadError) {
        console.error(`process-photo-upload: Failed to upload ${size} thumbnail`, uploadError);
        continue;
      }

      // Create signed URL for the thumbnail (1 year expiry)
      const { data: signedUrl } = await supabaseAdmin.storage
        .from('job-media-thumbnails')
        .createSignedUrl(thumbnailPath, 60 * 60 * 24 * 365);

      if (signedUrl) {
        thumbnailUrls[size] = signedUrl.signedUrl;
      }
    }

    // Compute simple perceptual hash (placeholder - real pHash would use DCT)
    // For now, we'll create a simple hash based on file characteristics
    const simpleHash = await computeSimpleHash(uint8Array);
    
    console.log(`process-photo-upload: Computed hash ${simpleHash}`);

    // Update job_media record with thumbnail URLs and status
    const { error: updateError } = await supabaseAdmin
      .from('job_media')
      .update({
        thumbnail_url_sm: thumbnailUrls.sm,
        thumbnail_url_md: thumbnailUrls.md,
        thumbnail_url_lg: thumbnailUrls.lg,
        perceptual_hash: simpleHash,
        status: 'ready',
        processing_error: null,
      })
      .eq('id', media_id);

    if (updateError) {
      console.error('process-photo-upload: Failed to update job_media', updateError);
      throw updateError;
    }

    console.log('process-photo-upload: Successfully processed photo');

    return new Response(
      JSON.stringify({
        success: true,
        media_id,
        thumbnails: thumbnailUrls,
        hash: simpleHash,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('process-photo-upload: Error', error);

    // Try to update the record with error status
    try {
      const { media_id }: ProcessPhotoRequest = await req.clone().json();
      if (media_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabaseAdmin
          .from('job_media')
          .update({
            status: 'failed',
            processing_error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', media_id);
      }
    } catch {
      // Ignore errors when trying to update failure status
    }

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

// Simple hash computation (placeholder for real pHash)
async function computeSimpleHash(data: Uint8Array): Promise<string> {
  // Use SubtleCrypto to compute SHA-256, then take first 16 chars
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16);
}
