import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseExportAnnotationOptions {
  onSuccess?: (renderedUrl: string) => void;
  onError?: (error: Error) => void;
}

interface ExportResult {
  success: boolean;
  rendered_url: string;
  format: string;
  width: number;
  height: number;
  object_count: number;
}

export function useExportAnnotation(options: UseExportAnnotationOptions = {}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const exportAnnotation = async (annotationId: string): Promise<ExportResult | null> => {
    setIsExporting(true);
    setProgress('Preparing render...');

    try {
      // Get the current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      setProgress('Rendering annotations...');

      // Call the render-annotation edge function
      const { data, error } = await supabase.functions.invoke('render-annotation', {
        body: {
          annotation_id: annotationId,
          format: 'png',
          quality: 90,
        },
      });

      if (error) {
        throw new Error(error.message || 'Render failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Render failed');
      }

      setProgress('Render complete!');
      options.onSuccess?.(data.rendered_url);

      return data as ExportResult;

    } catch (error) {
      console.error('Export annotation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      toast.error('Export failed', { description: errorMessage });
      options.onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;

    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const downloadRendered = async (renderedUrl: string, filename?: string) => {
    try {
      const response = await fetch(renderedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `annotated-photo-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  };

  return {
    exportAnnotation,
    downloadRendered,
    isExporting,
    progress,
  };
}

// Queue a render job for background processing
export async function queueRenderJob(annotationId: string, priority: number = 0): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('render_jobs')
      .insert({
        annotation_id: annotationId,
        status: 'pending',
        priority,
        attempts: 0,
        max_attempts: 3,
      });

    if (error) {
      console.error('Failed to queue render job:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Queue render job error:', error);
    return false;
  }
}
