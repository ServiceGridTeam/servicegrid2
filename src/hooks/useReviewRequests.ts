import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { toast } from 'sonner';

export interface ReviewRequest {
  id: string;
  business_id: string;
  customer_id: string;
  job_id: string;
  assigned_technician_id: string | null;
  scheduled_send_at: string;
  actual_sent_at: string | null;
  channel: 'email' | 'sms';
  status: 'scheduled' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'completed' | 'skipped' | 'failed' | 'cancelled';
  message_id: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  token: string;
  token_expires_at: string;
  reminder_count: number;
  last_reminder_at: string | null;
  next_reminder_at: string | null;
  review_id: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  job?: {
    title: string;
    actual_end: string | null;
  } | null;
}

export interface ReviewRequestFilters {
  status?: string;
  channel?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function useReviewRequests(filters: ReviewRequestFilters = {}) {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ['review-requests', businessId, filters],
    queryFn: async (): Promise<ReviewRequest[]> => {
      if (!businessId) return [];

      let queryBuilder = supabase
        .from('review_requests')
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone),
          job:jobs(title, actual_end)
        `)
        .eq('business_id', businessId)
        .order('scheduled_send_at', { ascending: false });

      if (filters.status) {
        queryBuilder = queryBuilder.eq('status', filters.status);
      }

      if (filters.channel) {
        queryBuilder = queryBuilder.eq('channel', filters.channel);
      }

      if (filters.dateFrom) {
        queryBuilder = queryBuilder.gte('scheduled_send_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        queryBuilder = queryBuilder.lte('scheduled_send_at', filters.dateTo);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Failed to fetch review requests:', error);
        throw error;
      }

      return (data || []) as ReviewRequest[];
    },
    enabled: !!businessId,
    staleTime: 60 * 1000,
  });
}

export function useCancelReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('review_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .in('status', ['scheduled']);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] });
      toast.success('Review request cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel request');
    },
  });
}

export function useResendReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('review_requests')
        .update({
          status: 'scheduled',
          scheduled_send_at: new Date().toISOString(),
          retry_count: 0,
          error_message: null,
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-requests'] });
      toast.success('Review request rescheduled');
    },
    onError: () => {
      toast.error('Failed to resend request');
    },
  });
}

export function useReviewRequestStats() {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ['review-request-stats', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: all, error: allError } = await supabase
        .from('review_requests')
        .select('status, actual_sent_at')
        .eq('business_id', businessId);

      if (allError) throw allError;

      const sentToday = all?.filter(r => 
        r.actual_sent_at && new Date(r.actual_sent_at) >= today
      ).length || 0;

      const pending = all?.filter(r => r.status === 'scheduled').length || 0;
      const sent = all?.filter(r => ['sent', 'delivered', 'opened', 'clicked', 'completed'].includes(r.status)).length || 0;
      const opened = all?.filter(r => ['opened', 'clicked', 'completed'].includes(r.status)).length || 0;
      const clicked = all?.filter(r => ['clicked', 'completed'].includes(r.status)).length || 0;
      const completed = all?.filter(r => r.status === 'completed').length || 0;

      const openRate = sent > 0 ? (opened / sent) * 100 : 0;
      const clickRate = sent > 0 ? (clicked / sent) * 100 : 0;
      const completionRate = sent > 0 ? (completed / sent) * 100 : 0;

      return {
        sentToday,
        pending,
        sent,
        opened,
        clicked,
        completed,
        openRate: Math.round(openRate * 10) / 10,
        clickRate: Math.round(clickRate * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
      };
    },
    enabled: !!businessId,
    staleTime: 2 * 60 * 1000,
  });
}
