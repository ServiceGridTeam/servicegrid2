import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing render queue...');

    // Fetch pending render jobs (limit 5 at a time)
    const { data: pendingJobs, error: fetchError } = await supabase
      .from('render_jobs')
      .select('*')
      .eq('status', 'pending')
      .or('next_retry_at.is.null,next_retry_at.lte.now()')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error('Error fetching pending jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending jobs', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('No pending render jobs');
      return new Response(
        JSON.stringify({ message: 'No pending jobs', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingJobs.length} pending render jobs`);

    const results = [];

    for (const job of pendingJobs) {
      console.log(`Processing job ${job.id} for annotation ${job.annotation_id}`);

      // Mark job as processing
      await supabase
        .from('render_jobs')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1,
        })
        .eq('id', job.id);

      try {
        // Call render-annotation function
        const renderResponse = await fetch(`${supabaseUrl}/functions/v1/render-annotation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            annotation_id: job.annotation_id,
            format: 'png',
            quality: 90,
          }),
        });

        if (!renderResponse.ok) {
          const errorText = await renderResponse.text();
          throw new Error(`Render failed: ${renderResponse.status} - ${errorText}`);
        }

        const renderResult = await renderResponse.json();

        // Mark job as completed
        await supabase
          .from('render_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', job.id);

        results.push({
          job_id: job.id,
          annotation_id: job.annotation_id,
          status: 'completed',
          rendered_url: renderResult.rendered_url,
        });

        console.log(`Job ${job.id} completed successfully`);

      } catch (renderError) {
        const errorMessage = renderError instanceof Error ? renderError.message : 'Unknown error';
        console.error(`Job ${job.id} failed:`, errorMessage);

        // Check if max attempts reached
        const maxAttempts = job.max_attempts || 3;
        const newAttempts = job.attempts + 1;

        if (newAttempts >= maxAttempts) {
          // Mark as failed permanently
          await supabase
            .from('render_jobs')
            .update({
              status: 'failed',
              last_error: errorMessage,
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // Update annotation with error
          await supabase
            .from('media_annotations')
            .update({
              render_error: errorMessage,
            })
            .eq('id', job.annotation_id);

        } else {
          // Schedule retry with exponential backoff
          const retryDelay = Math.pow(2, newAttempts) * 60 * 1000; // 2^n minutes
          const nextRetryAt = new Date(Date.now() + retryDelay).toISOString();

          await supabase
            .from('render_jobs')
            .update({
              status: 'pending',
              last_error: errorMessage,
              next_retry_at: nextRetryAt,
            })
            .eq('id', job.id);
        }

        results.push({
          job_id: job.id,
          annotation_id: job.annotation_id,
          status: 'failed',
          error: errorMessage,
          will_retry: newAttempts < maxAttempts,
        });
      }
    }

    console.log(`Processed ${results.length} jobs`);

    return new Response(
      JSON.stringify({
        message: 'Queue processed',
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Process render queue error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
