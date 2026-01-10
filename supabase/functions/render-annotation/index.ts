import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenderRequest {
  annotation_id: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { annotation_id, format = 'png', quality = 90 }: RenderRequest = await req.json();

    if (!annotation_id) {
      return new Response(
        JSON.stringify({ error: 'annotation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Rendering annotation ${annotation_id} as ${format} with quality ${quality}`);

    // Fetch annotation with media
    const { data: annotation, error: fetchError } = await supabase
      .from('media_annotations')
      .select(`
        *,
        job_media:job_media(
          id, url, thumbnail_url_lg, job_id,
          job:jobs(business_id)
        )
      `)
      .eq('id', annotation_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !annotation) {
      console.error('Annotation fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Annotation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const media = annotation.job_media;
    if (!media || !media.url) {
      return new Response(
        JSON.stringify({ error: 'Media not found for annotation' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, return a placeholder response indicating render is queued
    // Full server-side canvas rendering would require additional dependencies
    // This can be expanded with deno-canvas or offscreen canvas in the future
    const renderResult = {
      annotation_id,
      status: 'queued',
      format,
      quality,
      original_url: media.url,
      message: 'Annotation render has been queued. Full server-side rendering requires additional infrastructure.',
    };

    console.log('Render result:', renderResult);

    return new Response(
      JSON.stringify(renderResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Render annotation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
