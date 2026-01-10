import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnnotationObject {
  id: string;
  type: string;
  x: number;
  y: number;
  color: string;
  strokeWidth: number;
  points?: number[];
  pointerLength?: number;
  pointerWidth?: number;
  fill?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  length?: number;
  unit?: string;
  showLabel?: boolean;
  tension?: number;
}

interface AnnotationData {
  version: number;
  objects: AnnotationObject[];
  canvas: { width: number; height: number; scale?: number };
}

interface RenderRequest {
  annotation_id: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

// Convert annotation objects to SVG elements
function annotationToSVG(obj: AnnotationObject, _scale: number = 1): string {
  const stroke = obj.color || '#FF0000';
  const strokeWidth = obj.strokeWidth || 3;

  switch (obj.type) {
    case 'arrow': {
      if (!obj.points || obj.points.length < 4) return '';
      const [x1, y1, x2, y2] = obj.points;
      const headLen = obj.pointerLength || 10;
      const headWidth = obj.pointerWidth || 10;
      
      // Calculate arrowhead points
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const x3 = x2 - headLen * Math.cos(angle - Math.PI / 6);
      const y3 = y2 - headLen * Math.sin(angle - Math.PI / 6);
      const x4 = x2 - headLen * Math.cos(angle + Math.PI / 6);
      const y4 = y2 - headLen * Math.sin(angle + Math.PI / 6);
      
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
              stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <polygon points="${x2},${y2} ${x3},${y3} ${x4},${y4}" 
                 fill="${stroke}" stroke="${stroke}" stroke-width="1"/>
      `;
    }
    
    case 'line': {
      if (!obj.points || obj.points.length < 4) return '';
      const [x1, y1, x2, y2] = obj.points;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                    stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
    }
    
    case 'rect': {
      return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width || 0}" height="${obj.height || 0}" 
                    stroke="${stroke}" stroke-width="${strokeWidth}" fill="${obj.fill || 'none'}"/>`;
    }
    
    case 'circle': {
      return `<circle cx="${obj.x}" cy="${obj.y}" r="${obj.radius || 0}" 
                      stroke="${stroke}" stroke-width="${strokeWidth}" fill="${obj.fill || 'none'}"/>`;
    }
    
    case 'ellipse': {
      return `<ellipse cx="${obj.x}" cy="${obj.y}" rx="${obj.radiusX || 0}" ry="${obj.radiusY || 0}" 
                       stroke="${stroke}" stroke-width="${strokeWidth}" fill="${obj.fill || 'none'}"/>`;
    }
    
    case 'text': {
      const fontSize = obj.fontSize || 16;
      const fontFamily = obj.fontFamily || 'Arial, sans-serif';
      // Escape special characters in text
      const escapedText = (obj.text || '').replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return entities[char] || char;
      });
      return `<text x="${obj.x}" y="${obj.y}" font-size="${fontSize}" font-family="${fontFamily}" 
                    fill="${stroke}" dominant-baseline="hanging">${escapedText}</text>`;
    }
    
    case 'freehand': {
      if (!obj.points || obj.points.length < 4) return '';
      // Convert points array to SVG path
      const points = obj.points;
      let pathD = `M ${points[0]} ${points[1]}`;
      for (let i = 2; i < points.length; i += 2) {
        pathD += ` L ${points[i]} ${points[i + 1]}`;
      }
      return `<path d="${pathD}" stroke="${stroke}" stroke-width="${strokeWidth}" 
                    fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    
    case 'measurement': {
      if (!obj.points || obj.points.length < 4) return '';
      const [x1, y1, x2, y2] = obj.points;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const label = obj.showLabel !== false ? `${(obj.length || 0).toFixed(1)} ${obj.unit || 'px'}` : '';
      
      return `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
              stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
        <line x1="${x1 - 5}" y1="${y1 - 5}" x2="${x1 + 5}" y2="${y1 + 5}" 
              stroke="${stroke}" stroke-width="${strokeWidth}"/>
        <line x1="${x2 - 5}" y1="${y2 - 5}" x2="${x2 + 5}" y2="${y2 + 5}" 
              stroke="${stroke}" stroke-width="${strokeWidth}"/>
        ${label ? `<text x="${midX}" y="${midY - 10}" font-size="12" font-family="Arial" 
                         fill="${stroke}" text-anchor="middle">${label}</text>` : ''}
      `;
    }
    
    default:
      return '';
  }
}

// Build complete SVG with annotations overlaid on image
function buildAnnotationSVG(imageUrl: string, imageWidth: number, imageHeight: number, annotations: AnnotationObject[]): string {
  const annotationSVGs = annotations.map(obj => annotationToSVG(obj)).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
  <image href="${imageUrl}" width="${imageWidth}" height="${imageHeight}"/>
  ${annotationSVGs}
</svg>`;
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

    // Parse annotation data
    const annotationData = annotation.annotation_data as AnnotationData;
    if (!annotationData || !annotationData.objects) {
      return new Response(
        JSON.stringify({ error: 'Invalid annotation data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { width, height } = annotationData.canvas;
    if (!width || !height) {
      return new Response(
        JSON.stringify({ error: 'Invalid canvas dimensions' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Building SVG: ${width}x${height} with ${annotationData.objects.length} objects`);

    // Build SVG with annotations
    const svg = buildAnnotationSVG(media.url, width, height, annotationData.objects);

    // Convert SVG to PNG using resvg-wasm
    // Note: For full implementation, we'd use resvg-wasm here
    // For now, return the SVG and let frontend handle final rasterization if needed
    
    const svgBlob = new TextEncoder().encode(svg);
    
    // Upload to storage
    const fileName = `${annotation.business_id}/${annotation_id}_${Date.now()}.svg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('rendered-annotations')
      .upload(fileName, svgBlob, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload rendered image', details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('rendered-annotations')
      .getPublicUrl(fileName);

    const renderedUrl = publicUrlData.publicUrl;

    // Update annotation with rendered URL
    const { error: updateError } = await supabase
      .from('media_annotations')
      .update({
        rendered_url: renderedUrl,
        rendered_at: new Date().toISOString(),
        render_error: null,
      })
      .eq('id', annotation_id);

    if (updateError) {
      console.error('Update error:', updateError);
      // Non-fatal, continue
    }

    console.log('Render complete:', renderedUrl);

    return new Response(
      JSON.stringify({
        success: true,
        annotation_id,
        rendered_url: renderedUrl,
        format: 'svg', // Currently SVG, can be upgraded to PNG with resvg-wasm
        width,
        height,
        object_count: annotationData.objects.length,
      }),
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
