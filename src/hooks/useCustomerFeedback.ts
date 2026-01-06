import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from '@/lib/portalLocalState';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface FeedbackData {
  jobId: string;
  rating: number;
  comment?: string;
  technicianRating?: number;
  timelinessRating?: number;
  qualityRating?: number;
}

interface PendingJob {
  jobId: string;
  jobTitle: string;
  completedAt: string;
}

export function useCustomerFeedback() {
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ['portal-pending-feedback'],
    queryFn: async (): Promise<PendingJob[]> => {
      const token = getPortalSessionToken();
      if (!token) return [];

      const { data, error } = await supabase.functions.invoke('portal-feedback', {
        body: { action: 'get-pending' },
        headers: { 'X-Portal-Session': token },
      });

      if (error || data?.error) {
        console.error('Failed to fetch pending feedback:', error || data?.error);
        return [];
      }

      return data.pendingJobs || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackData) => {
      const token = getPortalSessionToken();
      if (!token) throw new Error('Not authenticated');

      const { data: response, error } = await supabase.functions.invoke('portal-feedback', {
        body: { action: 'submit', ...data },
        headers: { 'X-Portal-Session': token },
      });

      if (error || response?.error) {
        throw new Error(response?.error || error?.message || 'Failed to submit feedback');
      }

      return response;
    },
    onSuccess: (_data, variables) => {
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Remove job from pending list optimistically
      queryClient.setQueryData(['portal-pending-feedback'], (old: PendingJob[] | undefined) => 
        (old || []).filter(job => job.jobId !== variables.jobId)
      );

      toast.success('Thank you for your feedback!');

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['portal-pending-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['portal-feedback-history'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
    },
  });

  const historyQuery = useQuery({
    queryKey: ['portal-feedback-history'],
    queryFn: async () => {
      const token = getPortalSessionToken();
      if (!token) return [];

      const { data, error } = await supabase.functions.invoke('portal-feedback', {
        body: { action: 'get-history' },
        headers: { 'X-Portal-Session': token },
      });

      if (error || data?.error) {
        console.error('Failed to fetch feedback history:', error || data?.error);
        return [];
      }

      return data.feedback || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: false, // Only fetch when needed
  });

  return {
    pendingJobs: pendingQuery.data || [],
    isLoadingPending: pendingQuery.isLoading,
    submit: submitMutation.mutate,
    submitAsync: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    hasPendingFeedback: (pendingQuery.data?.length || 0) > 0,
    fetchHistory: historyQuery.refetch,
    history: historyQuery.data || [],
  };
}
