import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FilterConfig {
  tags?: string[];
  exclude_tags?: string[];
  lead_status?: string[];
  has_email?: boolean;
  email_status?: string[];
  cities?: string[];
  states?: string[];
  sources?: string[];
  created_after?: string;
  created_before?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all audience segments
    const { data: segments, error: fetchError } = await supabase
      .from("audience_segments")
      .select("id, business_id, filter_config");

    if (fetchError) throw fetchError;

    console.log(`Processing ${segments?.length || 0} audience segments`);

    if (!segments || segments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No segments to process", updated: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let updated = 0;
    const errors: string[] = [];

    for (const segment of segments) {
      try {
        const filterConfig = segment.filter_config as FilterConfig;
        
        // Build query against customers table
        let query = supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("business_id", segment.business_id);

        // Apply filters based on filter_config
        if (filterConfig.has_email === true) {
          query = query.not("email", "is", null);
        }

        if (filterConfig.tags && filterConfig.tags.length > 0) {
          query = query.overlaps("tags", filterConfig.tags);
        }

        if (filterConfig.exclude_tags && filterConfig.exclude_tags.length > 0) {
          // For exclude, we need to check each tag doesn't exist
          for (const tag of filterConfig.exclude_tags) {
            query = query.not("tags", "cs", `{${tag}}`);
          }
        }

        if (filterConfig.lead_status && filterConfig.lead_status.length > 0) {
          query = query.in("lead_status", filterConfig.lead_status);
        }

        if (filterConfig.email_status && filterConfig.email_status.length > 0) {
          query = query.in("email_status", filterConfig.email_status);
        }

        if (filterConfig.cities && filterConfig.cities.length > 0) {
          query = query.in("city", filterConfig.cities);
        }

        if (filterConfig.states && filterConfig.states.length > 0) {
          query = query.in("state", filterConfig.states);
        }

        if (filterConfig.sources && filterConfig.sources.length > 0) {
          query = query.in("source", filterConfig.sources);
        }

        if (filterConfig.created_after) {
          query = query.gte("created_at", filterConfig.created_after);
        }

        if (filterConfig.created_before) {
          query = query.lte("created_at", filterConfig.created_before);
        }

        const { count, error: countError } = await query;

        if (countError) {
          console.error(`Error counting segment ${segment.id}:`, countError);
          errors.push(`${segment.id}: ${countError.message}`);
          continue;
        }

        // Update segment with new count
        const { error: updateError } = await supabase
          .from("audience_segments")
          .update({
            estimated_count: count || 0,
            last_calculated_at: new Date().toISOString(),
          })
          .eq("id", segment.id);

        if (updateError) {
          console.error(`Error updating segment ${segment.id}:`, updateError);
          errors.push(`${segment.id}: ${updateError.message}`);
          continue;
        }

        console.log(`Updated segment ${segment.id} with count ${count}`);
        updated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${segment.id}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated ${updated} of ${segments.length} segments`,
        updated,
        total: segments.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in compute-segment-counts:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
