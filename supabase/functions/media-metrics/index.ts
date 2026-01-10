import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BusinessMetrics {
  business_id: string;
  uploads_count: number;
  storage_bytes: number;
  thumbnails_bytes: number;
  scans_clean: number;
  scans_rejected: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Get all businesses
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .select("id");

    if (bizError) {
      throw new Error(`Failed to fetch businesses: ${bizError.message}`);
    }

    const metricsResults: BusinessMetrics[] = [];

    for (const business of businesses || []) {
      const businessId = business.id;

      // Count job_media uploads today
      const { count: uploadsToday } = await supabase
        .from("job_media")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", todayStart.toISOString());

      // Sum storage bytes for job_media
      const { data: storageSums } = await supabase
        .from("job_media")
        .select("file_size_bytes")
        .eq("business_id", businessId);

      const totalStorageBytes = (storageSums || []).reduce(
        (sum, m) => sum + (m.file_size_bytes || 0),
        0
      );

      // Count clean scans today
      const { count: scansClean } = await supabase
        .from("customer_media_uploads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("scan_status", "clean")
        .gte("scan_completed_at", todayStart.toISOString());

      // Count rejected scans today
      const { count: scansRejected } = await supabase
        .from("customer_media_uploads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("scan_status", "rejected")
        .gte("scan_completed_at", todayStart.toISOString());

      // Count pending in queue
      const { count: queueDepth } = await supabase
        .from("customer_media_uploads")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("scan_status", "pending");

      const metrics: BusinessMetrics = {
        business_id: businessId,
        uploads_count: uploadsToday || 0,
        storage_bytes: totalStorageBytes,
        thumbnails_bytes: 0, // Would need to calculate from thumbnail_urls
        scans_clean: scansClean || 0,
        scans_rejected: scansRejected || 0,
      };

      metricsResults.push(metrics);

      // Upsert to database
      const { error: upsertError } = await supabase
        .from("media_metrics")
        .upsert({
          business_id: businessId,
          metric_date: today,
          uploads_count: metrics.uploads_count,
          storage_bytes: metrics.storage_bytes,
          thumbnails_bytes: metrics.thumbnails_bytes,
          scans_clean: metrics.scans_clean,
          scans_rejected: metrics.scans_rejected,
        }, {
          onConflict: "business_id,metric_date",
        });

      if (upsertError) {
        console.error(`Failed to upsert metrics for ${businessId}:`, upsertError);
      }
    }

    // Also compute platform-wide rate limit stats
    const { count: rateLimitHitsToday } = await supabase
      .from("upload_rate_limits")
      .select("id", { count: "exact", head: true })
      .gte("window_start", todayStart.toISOString());

    console.log("Metrics computed:", {
      businesses: metricsResults.length,
      rateLimitHitsToday,
    });

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metricsResults,
        platform: {
          rateLimitHitsToday: rateLimitHitsToday || 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Metrics computation error:", error);
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
