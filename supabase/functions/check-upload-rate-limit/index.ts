import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip',
};

interface RateLimitRequest {
  session_token?: string;
  business_id?: string;
}

// Rate limit configuration
const RATE_LIMITS = {
  ip: { limit: 10, window: 60 * 60 * 1000 }, // 10 per hour
  session: { limit: 20, window: 24 * 60 * 60 * 1000 }, // 20 per day
  business: { limit: 100, window: 24 * 60 * 60 * 1000 }, // 100 per day
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('check-upload-rate-limit: Starting');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { session_token, business_id }: RateLimitRequest = await req.json();
    
    // Get client IP from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    console.log(`check-upload-rate-limit: Checking limits for IP=${clientIp}, session=${session_token?.slice(0, 8)}..., business=${business_id}`);

    const results: Record<string, { allowed: boolean; remaining: number; resetAt: string }> = {};
    let allAllowed = true;

    // Check IP rate limit
    const ipResult = await checkRateLimit(supabaseAdmin, clientIp, 'ip', RATE_LIMITS.ip);
    results.ip = ipResult;
    if (!ipResult.allowed) allAllowed = false;

    // Check session rate limit if session provided
    if (session_token) {
      const sessionResult = await checkRateLimit(supabaseAdmin, session_token, 'session', RATE_LIMITS.session);
      results.session = sessionResult;
      if (!sessionResult.allowed) allAllowed = false;
    }

    // Check business rate limit if business_id provided
    if (business_id) {
      const businessResult = await checkRateLimit(supabaseAdmin, business_id, 'business', RATE_LIMITS.business);
      results.business = businessResult;
      if (!businessResult.allowed) allAllowed = false;
    }

    console.log(`check-upload-rate-limit: Result - allowed=${allAllowed}`, results);

    // If allowed, increment all counters
    if (allAllowed) {
      await incrementCounter(supabaseAdmin, clientIp, 'ip', RATE_LIMITS.ip.window);
      if (session_token) {
        await incrementCounter(supabaseAdmin, session_token, 'session', RATE_LIMITS.session.window);
      }
      if (business_id) {
        await incrementCounter(supabaseAdmin, business_id, 'business', RATE_LIMITS.business.window);
      }
    }

    return new Response(
      JSON.stringify({
        allowed: allAllowed,
        limits: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allAllowed ? 200 : 429,
      }
    );
  } catch (error) {
    console.error('check-upload-rate-limit: Error', error);
    // On error, allow the upload (fail open for rate limiting)
    return new Response(
      JSON.stringify({
        allowed: true,
        error: 'Rate limit check failed, allowing upload',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});

async function checkRateLimit(
  supabase: any,
  identifier: string,
  identifierType: 'ip' | 'session' | 'business',
  config: { limit: number; window: number }
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const windowStart = new Date(Date.now() - config.window);
  
  // Get current count for this identifier within the window
  const { data, error } = await supabase
    .from('upload_rate_limits')
    .select('*')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .gte('window_start', windowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1);

  if (error) {
    console.error('check-upload-rate-limit: Failed to fetch rate limit', error);
    // Fail open
    return { allowed: true, remaining: config.limit, resetAt: new Date(Date.now() + config.window).toISOString() };
  }

  const currentCount = data?.[0]?.count || 0;
  const remaining = Math.max(0, config.limit - currentCount);
  const resetAt = data?.[0]?.window_start 
    ? new Date(new Date(data[0].window_start).getTime() + config.window).toISOString()
    : new Date(Date.now() + config.window).toISOString();

  return {
    allowed: currentCount < config.limit,
    remaining,
    resetAt,
  };
}

async function incrementCounter(
  supabase: any,
  identifier: string,
  identifierType: 'ip' | 'session' | 'business',
  windowMs: number
) {
  const windowStart = new Date(Date.now() - windowMs);
  
  // Try to find existing record in window
  const { data: existing } = await supabase
    .from('upload_rate_limits')
    .select('id, count')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .gte('window_start', windowStart.toISOString())
    .order('window_start', { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    // Increment existing counter
    await supabase
      .from('upload_rate_limits')
      .update({ count: existing[0].count + 1 })
      .eq('id', existing[0].id);
  } else {
    // Create new counter
    await supabase
      .from('upload_rate_limits')
      .insert({
        identifier,
        identifier_type: identifierType,
        count: 1,
        window_start: new Date().toISOString(),
      });
  }
}
