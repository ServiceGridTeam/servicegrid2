import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================
// Helper Functions
// =====================

function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(`[cleanup-gallery-data] ${event}`, JSON.stringify(data));
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =====================
// Cleanup Functions
// =====================

async function cleanupExpiredShares(supabase: SupabaseClient): Promise<number> {
  // Mark expired shares as inactive
  const { data, error } = await supabase
    .from('photo_gallery_shares')
    .update({ is_active: false })
    .lt('expires_at', new Date().toISOString())
    .eq('is_active', true)
    .eq('is_permanent', false)
    .select('id');
  
  if (error) {
    logEvent('cleanup_shares_error', { error: error.message });
    return 0;
  }
  
  return (data as { id: string }[] | null)?.length || 0;
}

async function cleanupExpiredReports(supabase: SupabaseClient): Promise<{ marked: number; paths: string[] }> {
  // First, mark expired reports
  const { error: markError } = await supabase
    .from('photo_reports')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'ready');
  
  if (markError) {
    logEvent('mark_expired_error', { error: markError.message });
  }
  
  // Call the cleanup function to get paths and clear them
  const { data, error } = await supabase.rpc('cleanup_expired_report_files');
  
  if (error) {
    logEvent('cleanup_files_error', { error: error.message });
    return { marked: 0, paths: [] };
  }
  
  // Handle the RPC response
  const result = Array.isArray(data) ? data[0] : data;
  const filesMarked = result?.files_marked || 0;
  const storagePaths = result?.storage_paths || [];
  
  return { 
    marked: filesMarked, 
    paths: storagePaths 
  };
}

async function deleteStorageFiles(
  supabase: SupabaseClient, 
  paths: string[]
): Promise<number> {
  if (!paths.length) return 0;
  
  let deleted = 0;
  
  // Delete in batches
  const batchSize = 10;
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    
    const { error } = await supabase
      .storage
      .from('reports')
      .remove(batch);
    
    if (error) {
      logEvent('delete_files_error', { error: error.message, batch });
    } else {
      deleted += batch.length;
    }
  }
  
  return deleted;
}

async function releaseStaleQueueLocks(supabase: SupabaseClient): Promise<number> {
  // Release jobs that have been processing for more than 5 minutes
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  // Just reset status for stale jobs
  const { data: resetData, error: resetError } = await supabase
    .from('report_generation_queue')
    .update({ status: 'pending', worker_id: null })
    .eq('status', 'processing')
    .lt('started_at', staleThreshold)
    .select('id');
  
  if (resetError) {
    logEvent('release_locks_error', { error: resetError.message });
    return 0;
  }
  
  return (resetData as { id: string }[] | null)?.length || 0;
}

async function cleanupOldViews(supabase: SupabaseClient): Promise<number> {
  // Delete view records older than 90 days for privacy
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('gallery_share_views')
    .delete()
    .lt('viewed_at', cutoffDate)
    .select('id');
  
  if (error) {
    logEvent('cleanup_views_error', { error: error.message });
    return 0;
  }
  
  return (data as { id: string }[] | null)?.length || 0;
}

async function cleanupDeadLetterQueue(supabase: SupabaseClient): Promise<number> {
  // Remove dead letter items older than 7 days
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('report_generation_queue')
    .delete()
    .eq('status', 'dead_letter')
    .lt('created_at', cutoffDate)
    .select('id');
  
  if (error) {
    logEvent('cleanup_deadletter_error', { error: error.message });
    return 0;
  }
  
  return (data as { id: string }[] | null)?.length || 0;
}

// =====================
// Main Handler
// =====================

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only allow POST
  if (req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Only POST requests are allowed");
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    logEvent('cleanup_started', { timestamp: new Date().toISOString() });
    
    // Run all cleanup tasks
    const [
      expiredShares,
      expiredReports,
      staleLocks,
      oldViews,
      deadLetters
    ] = await Promise.all([
      cleanupExpiredShares(supabase),
      cleanupExpiredReports(supabase),
      releaseStaleQueueLocks(supabase),
      cleanupOldViews(supabase),
      cleanupDeadLetterQueue(supabase)
    ]);
    
    // Delete storage files for expired reports
    const deletedFiles = await deleteStorageFiles(supabase, expiredReports.paths);
    
    const results = {
      expired_shares_deactivated: expiredShares,
      expired_reports_marked: expiredReports.marked,
      report_files_deleted: deletedFiles,
      stale_queue_locks_released: staleLocks,
      old_views_deleted: oldViews,
      dead_letters_removed: deadLetters,
      completed_at: new Date().toISOString()
    };
    
    logEvent('cleanup_completed', results);
    
    return jsonResponse({ success: true, ...results });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logEvent('cleanup_error', { error: errorMessage });
    return errorResponse(500, "INTERNAL_ERROR", errorMessage);
  }
});
