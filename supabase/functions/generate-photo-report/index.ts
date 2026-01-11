import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createNotification } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================
// Types
// =====================

interface ReportConfig {
  report_type: 'standard' | 'before_after' | 'detailed' | 'custom';
  layout: 'grid' | 'timeline' | 'before_after' | 'single';
  page_size: 'letter' | 'a4';
  orientation: 'portrait' | 'landscape';
  photos_per_page: number;
  include_annotations: boolean;
  include_timestamps: boolean;
  include_gps: boolean;
  include_descriptions: boolean;
  cover_title?: string;
  cover_subtitle?: string;
  include_cover: boolean;
  include_toc: boolean;
}

interface QueueJob {
  id: string;
  report_id: string;
  business_id: string;
  priority: number;
  attempts: number;
}

interface Photo {
  id: string;
  file_url: string;
  thumbnail_url?: string;
  description?: string;
  category?: string;
  captured_at?: string;
  latitude?: number;
  longitude?: number;
  has_annotations?: boolean;
  sort_order?: number;
}

interface ReportData {
  id: string;
  job_id: string;
  business_id: string;
  report_type: string;
  config: ReportConfig;
  media_ids: string[];
  created_by: string;
}

interface JobData {
  title: string;
  job_number: string;
  address_line1?: string;
  city?: string;
  state?: string;
}

interface BusinessData {
  name: string;
}

// =====================
// Helper Functions
// =====================

function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(`[generate-photo-report] ${event}`, JSON.stringify(data));
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
// PDF Generation (using jsPDF-compatible approach)
// =====================

function generatePdfContent(
  report: ReportData,
  photos: Photo[],
  jobData: { title: string; job_number: string; address?: string },
  businessName: string
): Uint8Array {
  const config = report.config;
  
  // Create minimal PDF structure
  const pdfContent = createSimplePdf(
    config,
    photos,
    jobData,
    businessName,
    report.report_type
  );
  
  return pdfContent;
}

function createSimplePdf(
  config: ReportConfig,
  photos: Photo[],
  jobData: { title: string; job_number: string; address?: string },
  businessName: string,
  reportType: string
): Uint8Array {
  const encoder = new TextEncoder();
  
  const title = config.cover_title || `Photo Report - ${jobData.job_number}`;
  const subtitle = config.cover_subtitle || jobData.title;
  
  // Calculate page dimensions based on config
  const pageWidth = config.page_size === 'letter' ? 612 : 595.28;
  const pageHeight = config.page_size === 'letter' ? 792 : 841.89;
  
  // Swap for landscape
  const width = config.orientation === 'landscape' ? pageHeight : pageWidth;
  const height = config.orientation === 'landscape' ? pageWidth : pageHeight;
  
  // Build PDF content
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 obj >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 obj] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 obj /MediaBox [0 0 ${width} ${height}] /Contents 4 0 obj /Resources << /Font << /F1 5 0 obj >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 24 Tf
50 ${height - 100} Td
(${title}) Tj
0 -40 Td
/F1 16 Tf
(${subtitle}) Tj
0 -30 Td
/F1 12 Tf
(${businessName}) Tj
0 -20 Td
(${photos.length} photos included) Tj
0 -20 Td
(Report Type: ${reportType}) Tj
0 -20 Td
(Generated: ${new Date().toISOString().split('T')[0]}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000816 00000 n
trailer
<< /Size 6 /Root 1 0 obj >>
startxref
893
%%EOF`;
  
  return encoder.encode(content);
}

// =====================
// Queue Processing
// =====================

async function claimNextJob(supabase: SupabaseClient): Promise<QueueJob | null> {
  // Manual claiming with optimistic locking
  const { data: jobs, error: fetchError } = await supabase
    .from('report_generation_queue')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);
  
  if (fetchError || !jobs?.length) return null;
  
  const job = jobs[0] as QueueJob;
  
  // Try to claim it
  const { error: updateError } = await supabase
    .from('report_generation_queue')
    .update({ 
      status: 'processing',
      started_at: new Date().toISOString(),
      worker_id: crypto.randomUUID()
    })
    .eq('id', job.id)
    .eq('status', 'pending');
  
  if (updateError) return null;
  
  return job;
}

async function processQueueJob(
  supabase: SupabaseClient,
  queueJob: QueueJob
): Promise<{ success: boolean; error?: string }> {
  logEvent('processing_job', { queueId: queueJob.id, reportId: queueJob.report_id });
  
  try {
    // Fetch the report
    const { data: reportData, error: reportError } = await supabase
      .from('photo_reports')
      .select('*')
      .eq('id', queueJob.report_id)
      .single();
    
    if (reportError || !reportData) {
      throw new Error(`Report not found: ${queueJob.report_id}`);
    }
    
    const report = reportData as ReportData;
    
    // Update report status to generating
    await supabase
      .from('photo_reports')
      .update({ status: 'generating', generation_started_at: new Date().toISOString() })
      .eq('id', report.id);
    
    // Fetch photos
    const { data: photosData, error: photosError } = await supabase
      .from('job_media')
      .select('id, file_url, thumbnail_url, description, category, captured_at, latitude, longitude, has_annotations, sort_order')
      .in('id', report.media_ids || [])
      .order('sort_order', { ascending: true });
    
    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }
    
    const photos = (photosData || []) as Photo[];
    
    // Fetch job data
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('title, job_number, address_line1, city, state')
      .eq('id', report.job_id)
      .single();
    
    if (jobError || !jobData) {
      throw new Error(`Job not found: ${report.job_id}`);
    }
    
    const job = jobData as JobData;
    
    // Fetch business name
    const { data: businessData } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', report.business_id)
      .single();
    
    const business = businessData as BusinessData | null;
    const businessName = business?.name || 'Unknown Business';
    const address = [job.address_line1, job.city, job.state].filter(Boolean).join(', ');
    
    // Generate PDF
    const pdfContent = generatePdfContent(
      report,
      photos,
      { title: job.title, job_number: job.job_number, address },
      businessName
    );
    
    // Upload to storage
    const fileName = `${report.business_id}/${report.id}.pdf`;
    const { error: uploadError } = await supabase
      .storage
      .from('reports')
      .upload(fileName, pdfContent, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('reports')
      .getPublicUrl(fileName);
    
    // Calculate page count
    const photosPerPage = report.config?.photos_per_page || 6;
    const pageCount = Math.ceil(photos.length / photosPerPage) + 1;
    
    // Update report with success
    const { error: updateError } = await supabase
      .from('photo_reports')
      .update({
        status: 'ready',
        storage_path: fileName,
        file_url: urlData.publicUrl,
        file_size_bytes: pdfContent.length,
        page_count: pageCount,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .eq('id', report.id);
    
    if (updateError) {
      throw new Error(`Failed to update report: ${updateError.message}`);
    }
    
    // Mark queue job as completed
    await supabase
      .from('report_generation_queue')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', queueJob.id);
    
    // Send notification
    await createNotification(supabase, {
      userId: report.created_by,
      businessId: report.business_id,
      type: 'job',
      title: 'Photo Report Ready',
      message: `Your photo report for ${job.job_number} is ready to download.`,
      data: { reportId: report.id, jobId: report.job_id }
    });
    
    logEvent('job_completed', { reportId: report.id, pages: pageCount });
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logEvent('job_failed', { queueId: queueJob.id, error: errorMessage });
    
    // Update attempts and potentially move to dead letter
    const newAttempts = (queueJob.attempts || 0) + 1;
    const newStatus = newAttempts >= 3 ? 'dead_letter' : 'pending';
    
    await supabase
      .from('report_generation_queue')
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueJob.id);
    
    // Update report status to failed if max retries reached
    if (newStatus === 'dead_letter') {
      await supabase
        .from('photo_reports')
        .update({ status: 'failed', error_message: errorMessage })
        .eq('id', queueJob.report_id);
    }
    
    return { success: false, error: errorMessage };
  }
}

// =====================
// Main Handler
// =====================

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    // POST /generate-photo-report/trigger - Create report and enqueue
    if (req.method === "POST" && path === "trigger") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return errorResponse(401, "UNAUTHORIZED", "Missing authorization header");
      }
      
      // Verify user
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      
      if (authError || !user) {
        return errorResponse(401, "UNAUTHORIZED", "Invalid token");
      }
      
      const body = await req.json();
      const { job_id, business_id, media_ids, config, report_type = 'standard' } = body;
      
      if (!job_id || !business_id || !media_ids?.length) {
        return errorResponse(400, "INVALID_INPUT", "Missing required fields");
      }
      
      // Create the report record
      const { data: reportData, error: createError } = await supabase
        .from('photo_reports')
        .insert({
          job_id,
          business_id,
          report_type,
          config: config || {
            layout: 'grid',
            page_size: 'letter',
            orientation: 'portrait',
            photos_per_page: 6,
            include_annotations: true,
            include_timestamps: true,
            include_gps: false,
            include_descriptions: true,
            include_cover: true,
            include_toc: false
          },
          media_ids,
          created_by: user.id,
          status: 'pending'
        })
        .select()
        .single();
      
      if (createError) {
        logEvent('create_failed', { error: createError.message });
        return errorResponse(500, "CREATE_FAILED", createError.message);
      }
      
      const report = reportData as { id: string };
      
      // Enqueue the report
      const { data: queueId, error: queueError } = await supabase.rpc(
        'enqueue_report_generation',
        { p_report_id: report.id, p_business_id: business_id, p_priority: 0 }
      );
      
      if (queueError) {
        logEvent('enqueue_failed', { error: queueError.message });
        // Still return success as report was created
      }
      
      logEvent('report_created', { reportId: report.id, queueId, photoCount: media_ids.length });
      
      return jsonResponse({ 
        success: true, 
        report: { id: report.id, status: 'pending' },
        queue_id: queueId
      });
    }
    
    // POST /generate-photo-report/process - Process queue (called by cron or manually)
    if (req.method === "POST" && path === "process") {
      // Claim and process next job
      const queueJob = await claimNextJob(supabase);
      
      if (!queueJob) {
        return jsonResponse({ success: true, message: 'No pending jobs' });
      }
      
      const result = await processQueueJob(supabase, queueJob);
      return jsonResponse(result);
    }
    
    // GET /generate-photo-report/status/:id - Check report status
    if (req.method === "GET" && url.searchParams.has("report_id")) {
      const reportId = url.searchParams.get("report_id");
      
      const { data: report, error } = await supabase
        .from('photo_reports')
        .select('id, status, file_url, page_count, generated_at, error_message')
        .eq('id', reportId)
        .single();
      
      if (error || !report) {
        return errorResponse(404, "NOT_FOUND", "Report not found");
      }
      
      return jsonResponse(report);
    }
    
    return errorResponse(404, "NOT_FOUND", "Unknown endpoint");
    
  } catch (error) {
    logEvent('error', { error: error instanceof Error ? error.message : 'Unknown error' });
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
});
