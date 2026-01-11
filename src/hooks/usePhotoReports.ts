/**
 * Photo Reports Hook
 * Manages PDF report generation and retrieval
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ReportConfig {
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

export interface PhotoReport {
  id: string;
  job_id: string;
  business_id: string;
  report_type: string;
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'expired';
  config: ReportConfig;
  media_ids: string[];
  file_url?: string;
  page_count?: number;
  file_size_bytes?: number;
  generated_at?: string;
  expires_at?: string;
  error_message?: string;
  created_at: string;
  created_by: string;
}

// Fetch reports for a job
export function usePhotoReports(jobId: string) {
  return useQuery({
    queryKey: ['photo-reports', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photo_reports')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PhotoReport[];
    },
    enabled: !!jobId,
  });
}

// Create a new report
export function useCreateReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      jobId,
      businessId,
      mediaIds,
      config,
      reportType = 'standard',
    }: {
      jobId: string;
      businessId: string;
      mediaIds: string[];
      config?: Partial<ReportConfig>;
      reportType?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-photo-report/trigger', {
        body: {
          job_id: jobId,
          business_id: businessId,
          media_ids: mediaIds,
          config,
          report_type: reportType,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photo-reports', variables.jobId] });
      toast({
        title: 'Report queued',
        description: 'Your photo report is being generated. You\'ll be notified when it\'s ready.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create report',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Poll report status
export function useReportStatus(reportId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['report-status', reportId],
    queryFn: async () => {
      if (!reportId) return null;
      
      const { data, error } = await supabase
        .from('photo_reports')
        .select('id, status, file_url, page_count, generated_at, error_message')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data as Pick<PhotoReport, 'id' | 'status' | 'file_url' | 'page_count' | 'generated_at' | 'error_message'>;
    },
    enabled: !!reportId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 2s while pending/generating
      if (status === 'pending' || status === 'generating') return 2000;
      return false;
    },
  });
}

// Delete a report
export function useDeleteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ reportId, jobId }: { reportId: string; jobId: string }) => {
      const { error } = await supabase
        .from('photo_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      return { reportId, jobId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photo-reports', variables.jobId] });
      toast({ title: 'Report deleted' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete report',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// Default report config
export const defaultReportConfig: ReportConfig = {
  layout: 'grid',
  page_size: 'letter',
  orientation: 'portrait',
  photos_per_page: 6,
  include_annotations: true,
  include_timestamps: true,
  include_gps: false,
  include_descriptions: true,
  include_cover: true,
  include_toc: false,
};
