/**
 * Photo Reports Hook
 * Manages PDF report generation and retrieval
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

// Use the actual database type
type PhotoReportRow = Database['public']['Tables']['photo_reports']['Row'];

export interface PhotoReport {
  id: string;
  job_id: string;
  business_id: string;
  report_type: string;
  title: string;
  status: string | null;
  layout: string | null;
  paper_size: string | null;
  orientation: string | null;
  photos_per_page: number | null;
  include_annotations: boolean | null;
  include_timestamps: boolean | null;
  include_gps: boolean | null;
  include_descriptions: boolean | null;
  include_comparisons: boolean | null;
  include_media_ids: string[] | null;
  file_url: string | null;
  page_count: number | null;
  file_size_bytes: number | null;
  completed_at: string | null;
  expires_at: string | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string | null;
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
      title,
      reportType = 'standard',
      layout = 'grid',
      paperSize = 'letter',
      orientation = 'portrait',
      photosPerPage = 6,
      includeAnnotations = true,
      includeTimestamps = true,
      includeGps = false,
      includeDescriptions = true,
      includeComparisons = false,
    }: {
      jobId: string;
      businessId: string;
      mediaIds: string[];
      title?: string;
      reportType?: string;
      layout?: string;
      paperSize?: string;
      orientation?: string;
      photosPerPage?: number;
      includeAnnotations?: boolean;
      includeTimestamps?: boolean;
      includeGps?: boolean;
      includeDescriptions?: boolean;
      includeComparisons?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('generate-photo-report', {
        body: {
          job_id: jobId,
          business_id: businessId,
          include_media_ids: mediaIds,
          title: title || 'Photo Report',
          report_type: reportType,
          layout,
          paper_size: paperSize,
          orientation,
          photos_per_page: photosPerPage,
          include_annotations: includeAnnotations,
          include_timestamps: includeTimestamps,
          include_gps: includeGps,
          include_descriptions: includeDescriptions,
          include_comparisons: includeComparisons,
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
        .select('id, status, file_url, page_count, completed_at, error_message')
        .eq('id', reportId)
        .single();

      if (error) throw error;
      return data as Pick<PhotoReport, 'id' | 'status' | 'file_url' | 'page_count' | 'completed_at' | 'error_message'>;
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
export const defaultReportConfig = {
  layout: 'grid' as const,
  paper_size: 'letter' as const,
  orientation: 'portrait' as const,
  photos_per_page: 6,
  include_annotations: true,
  include_timestamps: true,
  include_gps: false,
  include_descriptions: true,
  include_comparisons: false,
};
