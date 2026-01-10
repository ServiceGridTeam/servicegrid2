import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConvertRequest {
  job_request_id: string;
  job_id: string;
}

interface CustomerUpload {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  original_filename: string;
  customer_id: string | null;
  business_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // User client for auth verification
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { job_request_id, job_id } = (await req.json()) as ConvertRequest;
    
    if (!job_request_id || !job_id) {
      return new Response(
        JSON.stringify({ error: "Missing job_request_id or job_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Converting customer uploads for request ${job_request_id} to job ${job_id}`);

    // Get job to verify access and get business_id
    const { data: job, error: jobError } = await serviceClient
      .from("jobs")
      .select("id, business_id, customer_id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer uploads linked to this job request that are clean
    const { data: uploads, error: uploadsError } = await serviceClient
      .from("customer_media_uploads")
      .select("*")
      .eq("job_request_id", job_request_id)
      .eq("scan_status", "clean")
      .is("converted_to_job_media_id", null);

    if (uploadsError) {
      console.error("Error fetching uploads:", uploadsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch customer uploads" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!uploads || uploads.length === 0) {
      console.log("No uploads to convert");
      return new Response(
        JSON.stringify({ converted: 0, message: "No uploads to convert" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${uploads.length} uploads to convert`);

    const results = {
      converted: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each upload
    for (const upload of uploads as CustomerUpload[]) {
      try {
        // Download file from customer-uploads bucket
        const { data: fileData, error: downloadError } = await serviceClient.storage
          .from(upload.storage_bucket)
          .download(upload.storage_path);

        if (downloadError || !fileData) {
          console.error(`Failed to download ${upload.id}:`, downloadError);
          results.failed++;
          results.errors.push(`Failed to download ${upload.original_filename}`);
          continue;
        }

        // Generate new path in job-media bucket
        const fileExt = upload.original_filename.split(".").pop()?.toLowerCase() || "jpg";
        const newFileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
        const newPath = `${job.business_id}/${job_id}/${newFileName}`;

        // Upload to job-media bucket
        const { error: uploadError } = await serviceClient.storage
          .from("job-media")
          .upload(newPath, fileData, {
            contentType: upload.mime_type,
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error(`Failed to upload ${upload.id}:`, uploadError);
          results.failed++;
          results.errors.push(`Failed to upload ${upload.original_filename}`);
          continue;
        }

        // Get signed URL for the new file
        const { data: signedUrlData } = await serviceClient.storage
          .from("job-media")
          .createSignedUrl(newPath, 60 * 60 * 24 * 365);

        const url = signedUrlData?.signedUrl || null;

        // Determine media type
        const mediaType = upload.mime_type.startsWith("video/") ? "video" : "photo";

        // Create job_media record
        const { data: jobMedia, error: insertError } = await serviceClient
          .from("job_media")
          .insert({
            business_id: job.business_id,
            job_id: job_id,
            customer_id: job.customer_id,
            media_type: mediaType,
            mime_type: upload.mime_type,
            file_extension: fileExt,
            storage_path: newPath,
            storage_bucket: "job-media",
            url,
            file_size_bytes: upload.file_size_bytes,
            category: "general",
            description: `Uploaded by customer: ${upload.original_filename}`,
            uploaded_by: user.id,
            upload_source: "customer_portal",
            status: "ready",
          })
          .select("id")
          .single();

        if (insertError || !jobMedia) {
          console.error(`Failed to create job_media for ${upload.id}:`, insertError);
          results.failed++;
          results.errors.push(`Failed to save ${upload.original_filename}`);
          continue;
        }

        // Update customer_media_uploads with conversion info
        const { error: updateError } = await serviceClient
          .from("customer_media_uploads")
          .update({
            converted_to_job_media_id: jobMedia.id,
            converted_at: new Date().toISOString(),
          })
          .eq("id", upload.id);

        if (updateError) {
          console.warn(`Failed to update conversion status for ${upload.id}:`, updateError);
          // Don't fail the whole operation for this
        }

        // Trigger thumbnail generation
        serviceClient.functions.invoke("process-photo-upload", {
          body: {
            media_id: jobMedia.id,
            storage_path: newPath,
            bucket: "job-media",
          },
        }).catch((err) => {
          console.warn("Thumbnail generation trigger failed:", err);
        });

        results.converted++;
        console.log(`Successfully converted ${upload.original_filename} -> ${jobMedia.id}`);
      } catch (error) {
        console.error(`Error processing upload ${upload.id}:`, error);
        results.failed++;
        results.errors.push(`Error processing ${upload.original_filename}`);
      }
    }

    console.log(`Conversion complete: ${results.converted} converted, ${results.failed} failed`);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
