import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  deletedRecords: number;
  deletedFiles: number;
  bytesReclaimed: number;
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: CleanupResult = {
      deletedRecords: 0,
      deletedFiles: 0,
      bytesReclaimed: 0,
      errors: [],
    };

    // Find jobs that were soft-deleted more than 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: deletedJobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id, business_id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", thirtyDaysAgo.toISOString());

    if (jobsError) {
      console.error("Error fetching deleted jobs:", jobsError);
      result.errors.push(`Failed to fetch deleted jobs: ${jobsError.message}`);
    }

    if (deletedJobs && deletedJobs.length > 0) {
      const jobIds = deletedJobs.map(j => j.id);
      console.log(`Found ${jobIds.length} jobs deleted 30+ days ago`);

      // Get all media for these jobs
      const { data: mediaRecords, error: mediaError } = await supabase
        .from("job_media")
        .select("id, storage_path, file_size_bytes, thumbnail_urls")
        .in("job_id", jobIds);

      if (mediaError) {
        console.error("Error fetching media records:", mediaError);
        result.errors.push(`Failed to fetch media: ${mediaError.message}`);
      }

      if (mediaRecords && mediaRecords.length > 0) {
        console.log(`Found ${mediaRecords.length} media records to clean up`);

        // Delete files from storage
        for (const media of mediaRecords) {
          try {
            // Delete original file
            if (media.storage_path) {
              const { error: deleteError } = await supabase.storage
                .from("job-media")
                .remove([media.storage_path]);

              if (deleteError) {
                console.error(`Failed to delete ${media.storage_path}:`, deleteError);
                result.errors.push(`Failed to delete file: ${media.storage_path}`);
              } else {
                result.deletedFiles++;
                result.bytesReclaimed += media.file_size_bytes || 0;
              }
            }

            // Delete thumbnails
            if (media.thumbnail_urls && typeof media.thumbnail_urls === 'object') {
              const thumbnailPaths: string[] = [];
              const urls = media.thumbnail_urls as Record<string, string>;
              
              // Extract paths from thumbnail URLs
              for (const [size, url] of Object.entries(urls)) {
                if (url && typeof url === 'string') {
                  // Extract path from signed URL or direct path
                  const pathMatch = url.match(/job-media-thumbnails\/([^?]+)/);
                  if (pathMatch) {
                    thumbnailPaths.push(pathMatch[1]);
                  }
                }
              }

              if (thumbnailPaths.length > 0) {
                const { error: thumbError } = await supabase.storage
                  .from("job-media-thumbnails")
                  .remove(thumbnailPaths);

                if (thumbError) {
                  console.error("Failed to delete thumbnails:", thumbError);
                } else {
                  result.deletedFiles += thumbnailPaths.length;
                }
              }
            }
          } catch (err) {
            console.error(`Error processing media ${media.id}:`, err);
            result.errors.push(`Error processing media ${media.id}`);
          }
        }

        // Delete database records
        const { error: deleteRecordsError } = await supabase
          .from("job_media")
          .delete()
          .in("job_id", jobIds);
        if (deleteRecordsError) {
          console.error("Error deleting media records:", deleteRecordsError);
          result.errors.push(`Failed to delete records: ${deleteRecordsError.message}`);
        } else {
          result.deletedRecords = mediaRecords.length;
        }
      }

      // Record metrics for each affected business
      const businessMetrics = new Map<string, { deleted: number; bytes: number }>();
      for (const job of deletedJobs) {
        const existing = businessMetrics.get(job.business_id) || { deleted: 0, bytes: 0 };
        businessMetrics.set(job.business_id, existing);
      }

      // Update metrics per business
      for (const media of mediaRecords || []) {
        // Find which business this media belongs to
        const job = deletedJobs.find(j => 
          mediaRecords?.some(m => m.id === media.id)
        );
        if (job) {
          const existing = businessMetrics.get(job.business_id) || { deleted: 0, bytes: 0 };
          existing.deleted++;
          existing.bytes += media.file_size_bytes || 0;
          businessMetrics.set(job.business_id, existing);
        }
      }

      // Upsert metrics
      const today = new Date().toISOString().split('T')[0];
      for (const [businessId, metrics] of businessMetrics) {
        await supabase
          .from("media_metrics")
          .upsert({
            business_id: businessId,
            metric_date: today,
            cleanup_deleted: metrics.deleted,
            cleanup_bytes_reclaimed: metrics.bytes,
          }, {
            onConflict: "business_id,metric_date",
          });
      }
    }

    console.log("Cleanup completed:", result);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
