import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limit store (resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration
const RATE_LIMITS = {
  gallery_view: { limit: 10, windowMs: 60000 }, // 10 req/min for views
  comment: { limit: 5, windowMs: 60000 }, // 5 req/min for comments
};

// =====================
// Helper Functions
// =====================

async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkRateLimit(key: string, type: keyof typeof RATE_LIMITS): boolean {
  const config = RATE_LIMITS[type];
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.limit) {
    return false;
  }

  entry.count++;
  return true;
}

function logEvent(event: string, data: Record<string, unknown>): void {
  console.log(`[public-gallery-api] ${event}`, JSON.stringify(data));
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

function sanitizeHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/&[^;]+;/g, "") // Strip HTML entities
    .trim();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" {
  const ua = userAgent.toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
    return "mobile";
  }
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) {
    return "tablet";
  }
  return "desktop";
}

function isValidTokenFormat(token: string): boolean {
  // Token should be 32 chars, alphanumeric (base64url safe)
  return /^[a-zA-Z0-9_-]{32,}$/.test(token);
}

function countUrls(text: string): number {
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlPattern);
  return matches ? matches.length : 0;
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "0.0.0.0";
}

// =====================
// Main Handler
// =====================

Deno.serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/public-gallery-api/, "");
  const method = req.method;

  logEvent("request", { method, path });

  try {
    // Route: GET /:token - Get gallery data
    const galleryMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
    if (method === "GET" && galleryMatch) {
      return await handleGetGallery(supabase, req, galleryMatch[1], startTime);
    }

    // Route: POST /:token/comment - Add comment
    const commentMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/comment$/);
    if (method === "POST" && commentMatch) {
      return await handleAddComment(supabase, req, commentMatch[1], startTime);
    }

    // Route: GET /:token/comments/:mediaId - Get comments for photo
    const getCommentsMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/comments\/([a-zA-Z0-9-]+)$/);
    if (method === "GET" && getCommentsMatch) {
      return await handleGetComments(supabase, req, getCommentsMatch[1], getCommentsMatch[2], startTime);
    }

    return errorResponse(404, "NOT_FOUND", "Endpoint not found");
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logEvent("gallery_error", { error: String(error), duration_ms: durationMs });
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
});

// =====================
// GET /:token - Gallery Data
// =====================

async function handleGetGallery(
  supabase: any,
  req: Request,
  token: string,
  startTime: number
): Promise<Response> {
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";
  const referer = req.headers.get("referer") || "";
  const url = new URL(req.url);
  const visitorEmail = url.searchParams.get("email");
  const fingerprint = url.searchParams.get("fp");

  // Validate token format
  if (!isValidTokenFormat(token)) {
    logEvent("gallery_invalid_token", { token_length: token.length });
    return errorResponse(400, "INVALID_TOKEN", "Invalid token format");
  }

  // Rate limit check
  const rateLimitKey = `view:${await hashString(clientIp)}`;
  if (!checkRateLimit(rateLimitKey, "gallery_view")) {
    logEvent("gallery_rate_limited", { ip_hash: await hashString(clientIp) });
    return errorResponse(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }

  // Hash token for lookup (constant-time security)
  const tokenHash = await hashString(token);

  // Lookup share by token hash
  const { data: share, error: shareError } = await supabase
    .from("photo_gallery_shares")
    .select(`
      id,
      business_id,
      job_id,
      share_token,
      title,
      message,
      is_active,
      is_permanent,
      expires_at,
      require_email,
      allow_download,
      allow_comments,
      include_comparisons,
      include_categories,
      exclude_media_ids,
      show_job_details,
      view_count,
      jobs(id, job_number, title, scheduled_start),
      businesses(id, name, logo_url, visitor_hash_salt)
    `)
    .eq("share_token", token)
    .single();

  if (shareError || !share) {
    logEvent("gallery_not_found", { token_hash: tokenHash.substring(0, 8) });
    return errorResponse(404, "NOT_FOUND", "Gallery not found");
  }

  // Check if active
  if (!share.is_active) {
    logEvent("gallery_inactive", { share_id: share.id });
    return errorResponse(410, "REVOKED", "This gallery is no longer available");
  }

  // Check expiration
  if (!share.is_permanent && share.expires_at) {
    const expiresAt = new Date(share.expires_at);
    if (expiresAt < new Date()) {
      logEvent("gallery_expired", { share_id: share.id });
      return errorResponse(410, "EXPIRED", "This gallery link has expired");
    }
  }

  // Check email gate
  if (share.require_email) {
    if (!visitorEmail) {
      return jsonResponse({
        requires_email: true,
        business_name: share.businesses?.name || "Unknown Business",
      }, 403);
    }
    if (!isValidEmail(visitorEmail)) {
      return errorResponse(400, "INVALID_EMAIL", "Invalid email format");
    }
  }

  // Fetch photos for this job
  let photosQuery = supabase
    .from("job_media")
    .select(`
      id,
      media_type,
      description,
      category,
      thumbnail_url_sm,
      thumbnail_url_md,
      thumbnail_url_lg,
      url,
      width,
      height,
      captured_at
    `)
    .eq("job_id", share.job_id)
    .eq("is_visible", true)
    .eq("status", "ready")
    .is("deleted_at", null)
    .order("captured_at", { ascending: true });

  // Filter by categories if specified
  if (share.include_categories && share.include_categories.length > 0) {
    photosQuery = photosQuery.in("category", share.include_categories);
  }

  // Exclude specific media if specified
  if (share.exclude_media_ids && share.exclude_media_ids.length > 0) {
    photosQuery = photosQuery.not("id", "in", `(${share.exclude_media_ids.join(",")})`);
  }

  const { data: photos, error: photosError } = await photosQuery;

  if (photosError) {
    logEvent("gallery_photos_error", { error: photosError.message, share_id: share.id });
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load gallery photos");
  }

  // Fetch comparisons if enabled
  let comparisons: any[] = [];
  if (share.include_comparisons) {
    const { data: compData } = await supabase
      .from("before_after_comparisons")
      .select(`
        id,
        title,
        display_mode,
        before_media:before_media_id(id, thumbnail_url_md, url),
        after_media:after_media_id(id, thumbnail_url_md, url)
      `)
      .eq("job_id", share.job_id)
      .is("deleted_at", null);

    comparisons = (compData || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      comparison_type: c.display_mode,
      before_media: c.before_media,
      after_media: c.after_media,
    }));
  }

  // Fetch gallery branding
  const { data: branding } = await supabase
    .from("gallery_brandings")
    .select("*")
    .eq("business_id", share.business_id)
    .single();

  // Build job info (respecting show_job_details)
  const jobInfo = share.show_job_details && share.jobs
    ? {
        number: share.jobs.job_number,
        title: share.jobs.title,
        date: share.jobs.scheduled_start,
      }
    : null;

  // Record view asynchronously (don't block response)
  recordGalleryView(supabase, {
    shareId: share.id,
    businessId: share.business_id,
    clientIp,
    userAgent,
    referer,
    fingerprint,
    visitorEmail,
    visitorHashSalt: share.businesses?.visitor_hash_salt,
  }).catch((err) => {
    logEvent("gallery_view_record_failed", { error: String(err), share_id: share.id });
  });

  const durationMs = Date.now() - startTime;
  logEvent("gallery_accessed", {
    share_id: share.id,
    business_id: share.business_id,
    photo_count: photos?.length || 0,
    duration_ms: durationMs,
  });

  return jsonResponse({
    gallery: {
      business: {
        name: share.businesses?.name,
        logo_url: share.businesses?.logo_url,
        branding: branding || null,
      },
      job: jobInfo,
      photos: photos || [],
      comparisons,
      permissions: {
        allow_download: share.allow_download,
        allow_comments: share.allow_comments,
      },
      message: share.message,
      title: share.title,
    },
  });
}

// =====================
// Record View (Async)
// =====================

async function recordGalleryView(
  supabase: any,
  params: {
    shareId: string;
    businessId: string;
    clientIp: string;
    userAgent: string;
    referer: string;
    fingerprint: string | null;
    visitorEmail: string | null;
    visitorHashSalt: string | null;
  }
): Promise<void> {
  const {
    shareId,
    businessId,
    clientIp,
    userAgent,
    referer,
    fingerprint,
    visitorEmail,
    visitorHashSalt,
  } = params;

  // Hash IP with business-specific salt for privacy
  const salt = visitorHashSalt || businessId;
  const visitorIpHash = await hashString(`${clientIp}:${salt}`);
  const visitorFingerprintHash = fingerprint
    ? await hashString(`${fingerprint}:${salt}`)
    : null;

  const referrerDomain = extractDomain(referer);
  const deviceType = detectDeviceType(userAgent);

  // Insert view record
  await supabase.from("gallery_views").insert({
    share_id: shareId,
    business_id: businessId,
    visitor_ip_hash: visitorIpHash,
    visitor_fingerprint_hash: visitorFingerprintHash,
    visitor_email: visitorEmail,
    device_type: deviceType,
    referrer_domain: referrerDomain,
    user_agent: userAgent.substring(0, 500),
    viewed_at: new Date().toISOString(),
  });

  // Increment view count atomically
  await supabase.rpc("increment_gallery_views_atomic", {
    p_share_id: shareId,
  });

  // Create audit log entry
  await supabase.from("gallery_share_audit_log").insert({
    share_id: shareId,
    business_id: businessId,
    action: "viewed",
    actor_type: "visitor",
    actor_ip_hash: visitorIpHash,
    user_agent: userAgent.substring(0, 500),
    details: {
      device_type: deviceType,
      referrer_domain: referrerDomain,
      has_email: !!visitorEmail,
    },
  });
}

// =====================
// POST /:token/comment
// =====================

async function handleAddComment(
  supabase: any,
  req: Request,
  token: string,
  startTime: number
): Promise<Response> {
  const clientIp = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "";

  // Validate token format
  if (!isValidTokenFormat(token)) {
    return errorResponse(400, "INVALID_TOKEN", "Invalid token format");
  }

  // Rate limit check for comments
  const rateLimitKey = `comment:${await hashString(clientIp)}:${token}`;
  if (!checkRateLimit(rateLimitKey, "comment")) {
    logEvent("comment_rate_limited", {
      ip_hash: await hashString(clientIp),
      share_token: token.substring(0, 8),
    });
    return errorResponse(429, "RATE_LIMITED", "Too many comments. Please try again later.");
  }

  // Parse body
  let body: {
    media_id: string;
    comment_text: string;
    author_name: string;
    is_question?: boolean;
    parent_comment_id?: string;
  };

  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "INVALID_BODY", "Invalid request body");
  }

  const { media_id, comment_text, author_name, is_question, parent_comment_id } = body;

  // Validate required fields
  if (!media_id || !comment_text || !author_name) {
    return errorResponse(400, "INVALID_COMMENT", "Missing required fields: media_id, comment_text, author_name");
  }

  // Validate comment length
  const sanitizedText = sanitizeHtml(comment_text);
  if (sanitizedText.length < 1 || sanitizedText.length > 2000) {
    return errorResponse(400, "INVALID_COMMENT", "Comment must be between 1 and 2000 characters");
  }

  // Validate author name
  const sanitizedName = sanitizeHtml(author_name);
  if (sanitizedName.length < 1 || sanitizedName.length > 100) {
    return errorResponse(400, "INVALID_COMMENT", "Author name must be between 1 and 100 characters");
  }

  // Spam check: URL density
  if (countUrls(sanitizedText) > 3) {
    return errorResponse(400, "INVALID_COMMENT", "Comment contains too many links");
  }

  // Lookup share
  const { data: share, error: shareError } = await supabase
    .from("photo_gallery_shares")
    .select("id, business_id, job_id, allow_comments, businesses(visitor_hash_salt)")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (shareError || !share) {
    return errorResponse(404, "NOT_FOUND", "Gallery not found");
  }

  // Check if comments are allowed
  if (!share.allow_comments) {
    return errorResponse(400, "COMMENTS_DISABLED", "Comments are not allowed on this gallery");
  }

  // Check thread depth if replying
  let threadDepth = 0;
  if (parent_comment_id) {
    const { data: parentComment } = await supabase
      .from("photo_comments")
      .select("id, thread_depth")
      .eq("id", parent_comment_id)
      .single();

    if (!parentComment) {
      return errorResponse(404, "NOT_FOUND", "Parent comment not found");
    }

    threadDepth = (parentComment.thread_depth || 0) + 1;
    if (threadDepth > 3) {
      return errorResponse(400, "MAX_DEPTH_EXCEEDED", "Maximum reply depth exceeded");
    }
  }

  // Hash IP for author tracking
  const salt = share.businesses?.visitor_hash_salt || share.business_id;
  const authorIpHash = await hashString(`${clientIp}:${salt}`);

  // Insert comment
  const { data: newComment, error: insertError } = await supabase
    .from("photo_comments")
    .insert({
      share_id: share.id,
      media_id,
      parent_comment_id: parent_comment_id || null,
      author_name: sanitizedName,
      author_ip_hash: authorIpHash,
      comment_text: sanitizedText,
      is_question: is_question || false,
      thread_depth: threadDepth,
      status: "visible",
    })
    .select()
    .single();

  if (insertError) {
    logEvent("comment_insert_error", { error: insertError.message });
    return errorResponse(500, "INTERNAL_ERROR", "Failed to add comment");
  }

  // Create audit log
  await supabase.from("gallery_share_audit_log").insert({
    share_id: share.id,
    business_id: share.business_id,
    action: "comment_added",
    actor_type: "visitor",
    actor_ip_hash: authorIpHash,
    user_agent: userAgent.substring(0, 500),
    details: {
      comment_id: newComment.id,
      media_id,
      is_question: is_question || false,
      is_reply: !!parent_comment_id,
    },
  });

  logEvent("comment_added", {
    share_id: share.id,
    media_id,
    is_question: is_question || false,
  });

  return jsonResponse({
    comment: {
      id: newComment.id,
      comment_text: newComment.comment_text,
      author_name: newComment.author_name,
      is_question: newComment.is_question,
      created_at: newComment.created_at,
    },
  }, 201);
}

// =====================
// GET /:token/comments/:mediaId
// =====================

async function handleGetComments(
  supabase: any,
  req: Request,
  token: string,
  mediaId: string,
  startTime: number
): Promise<Response> {
  const clientIp = getClientIp(req);

  // Validate token format
  if (!isValidTokenFormat(token)) {
    return errorResponse(400, "INVALID_TOKEN", "Invalid token format");
  }

  // Rate limit check
  const rateLimitKey = `view:${await hashString(clientIp)}`;
  if (!checkRateLimit(rateLimitKey, "gallery_view")) {
    return errorResponse(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }

  // Lookup share
  const { data: share, error: shareError } = await supabase
    .from("photo_gallery_shares")
    .select("id, business_id, allow_comments")
    .eq("share_token", token)
    .eq("is_active", true)
    .single();

  if (shareError || !share) {
    return errorResponse(404, "NOT_FOUND", "Gallery not found");
  }

  // Get comments for this media item
  const { data: comments, error: commentsError } = await supabase
    .from("photo_comments")
    .select(`
      id,
      parent_comment_id,
      author_name,
      comment_text,
      is_question,
      thread_depth,
      created_at,
      staff_reply,
      staff_reply_at,
      staff_reply_by
    `)
    .eq("share_id", share.id)
    .eq("media_id", mediaId)
    .eq("status", "visible")
    .order("created_at", { ascending: true });

  if (commentsError) {
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load comments");
  }

  // Build threaded structure
  const rootComments: any[] = [];
  const commentMap = new Map<string, any>();

  // First pass: create map and add replies array
  (comments || []).forEach((c: any) => {
    commentMap.set(c.id, { ...c, replies: [] });
  });

  // Second pass: organize into threads
  (comments || []).forEach((c: any) => {
    const comment = commentMap.get(c.id);
    if (c.parent_comment_id && commentMap.has(c.parent_comment_id)) {
      commentMap.get(c.parent_comment_id).replies.push(comment);
    } else {
      rootComments.push(comment);
    }
  });

  return jsonResponse({
    comments: rootComments,
    total: comments?.length || 0,
  });
}
