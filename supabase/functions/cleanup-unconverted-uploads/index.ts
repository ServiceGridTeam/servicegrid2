import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupResult {
  pendingCleaned: number;
  rejectedCleaned: number;
  filesDeleted: number;
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
      pendingCleaned: 0,
      rejectedCleaned: 0,
      filesDeleted: 0,
      errors: [],
    };

    // Calculate cutoff dates
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find pending uploads older than 30 days
    const { data: pendingUploads, error: pendingError } = await supabase
      .from("customer_media_uploads")
      .select("id, storage_path, storage_bucket, business_id")
      .eq("scan_status", "pending")
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (pendingError) {
      console.error("Error fetching pending uploads:", pendingError);
      result.errors.push(`Failed to fetch pending uploads: ${pendingError.message}`);
    }

    // Find rejected uploads older than 7 days
    const { data: rejectedUploads, error: rejectedError } = await supabase
      .from("customer_media_uploads")
      .select("id, storage_path, storage_bucket, business_id")
      .eq("scan_status", "rejected")
      .lt("created_at", sevenDaysAgo.toISOString());

    if (rejectedError) {
      console.error("Error fetching rejected uploads:", rejectedError);
      result.errors.push(`Failed to fetch rejected uploads: ${rejectedError.message}`);
    }

    // Combine all uploads to clean
    const allUploads = [...(pendingUploads || []), ...(rejectedUploads || [])];
    console.log(`Found ${pendingUploads?.length || 0} pending and ${rejectedUploads?.length || 0} rejected uploads to clean`);

    // Delete files from storage
    for (const upload of allUploads) {
      try {
        if (upload.storage_path && upload.storage_bucket) {
          const { error: deleteError } = await supabase.storage
            .from(upload.storage_bucket)
            .remove([upload.storage_path]);

          if (deleteError) {
            // File might already be deleted, log but don't fail
            console.warn(`Failed to delete ${upload.storage_path} from ${upload.storage_bucket}:`, deleteError);
          } else {
            result.filesDeleted++;
          }
        }
      } catch (err) {
        console.error(`Error deleting file for upload ${upload.id}:`, err);
        result.errors.push(`Failed to delete file for upload ${upload.id}`);
      }
    }

    // Delete pending records
    if (pendingUploads && pendingUploads.length > 0) {
      const pendingIds = pendingUploads.map(u => u.id);
      const { error: deletePendingError } = await supabase
        .from("customer_media_uploads")
        .delete()
        .in("id", pendingIds);

      if (deletePendingError) {
        console.error("Error deleting pending records:", deletePendingError);
        result.errors.push(`Failed to delete pending records: ${deletePendingError.message}`);
      } else {
        result.pendingCleaned = pendingUploads.length;
      }
    }

    // Delete rejected records
    if (rejectedUploads && rejectedUploads.length > 0) {
      const rejectedIds = rejectedUploads.map(u => u.id);
      const { error: deleteRejectedError } = await supabase
        .from("customer_media_uploads")
        .delete()
        .in("id", rejectedIds);

      if (deleteRejectedError) {
        console.error("Error deleting rejected records:", deleteRejectedError);
        result.errors.push(`Failed to delete rejected records: ${deleteRejectedError.message}`);
      } else {
        result.rejectedCleaned = rejectedUploads.length;
      }
    }

    // Update metrics per business
    const businessCounts = new Map<string, { pending: number; rejected: number }>();
    
    for (const upload of pendingUploads || []) {
      const existing = businessCounts.get(upload.business_id) || { pending: 0, rejected: 0 };
      existing.pending++;
      businessCounts.set(upload.business_id, existing);
    }
    
    for (const upload of rejectedUploads || []) {
      const existing = businessCounts.get(upload.business_id) || { pending: 0, rejected: 0 };
      existing.rejected++;
      businessCounts.set(upload.business_id, existing);
    }

    const today = new Date().toISOString().split('T')[0];
    for (const [businessId, counts] of businessCounts) {
      await supabase
        .from("media_metrics")
        .upsert({
          business_id: businessId,
          metric_date: today,
          cleanup_deleted: counts.pending + counts.rejected,
        }, {
          onConflict: "business_id,metric_date",
        });
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
