import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { toast } from 'sonner';

export interface ReviewConfig {
  id: string;
  business_id: string;
  auto_request_enabled: boolean;
  request_channel: 'email' | 'sms' | 'both';
  delay_minutes: number;
  minimum_job_value: number | null;
  cooldown_days: number;
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  send_on_weekends: boolean;
  google_place_id: string | null;
  google_review_url: string | null;
  yelp_business_id: string | null;
  yelp_review_url: string | null;
  facebook_page_id: string | null;
  facebook_review_url: string | null;
  promoter_threshold: number;
  detractor_threshold: number;
  sms_enabled: boolean;
  sms_sender_name: string | null;
  reminder_enabled: boolean;
  reminder_delay_hours: number;
  max_reminders: number;
  total_requests_sent: number;
  total_reviews_received: number;
  average_rating: number | null;
  response_rate: number | null;
  created_at: string;
  updated_at: string;
}

const LOCAL_STORAGE_KEY = 'review-config-cache';

function getCachedConfig(businessId: string): ReviewConfig | null {
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY}-${businessId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Check if cache is less than 5 minutes old
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function setCachedConfig(businessId: string, config: ReviewConfig) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}-${businessId}`, JSON.stringify({
      data: config,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore cache errors
  }
}

export function useReviewConfig() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  const query = useQuery({
    queryKey: ['review-config', businessId],
    queryFn: async (): Promise<ReviewConfig | null> => {
      if (!businessId) return null;

      const { data, error } = await supabase
        .from('review_configs')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch review config:', error);
        throw error;
      }

      if (data) {
        setCachedConfig(businessId, data as ReviewConfig);
      }

      return data as ReviewConfig | null;
    },
    enabled: !!businessId,
    initialData: () => (businessId ? getCachedConfig(businessId) : null),
    staleTime: 2 * 60 * 1000,
  });

  const upsertMutation = useMutation({
    mutationFn: async (config: Partial<ReviewConfig>) => {
      if (!businessId) throw new Error('No business selected');

      const { data, error } = await supabase
        .from('review_configs')
        .upsert({
          business_id: businessId,
          ...config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReviewConfig;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['review-config', businessId], data);
      if (businessId) {
        setCachedConfig(businessId, data);
      }
      toast.success('Review settings saved');
    },
    onError: (error) => {
      console.error('Failed to save review config:', error);
      toast.error('Failed to save review settings');
    },
  });

  const toggleAutoRequest = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!businessId) throw new Error('No business selected');

      const { data, error } = await supabase
        .from('review_configs')
        .upsert({
          business_id: businessId,
          auto_request_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'business_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data as ReviewConfig;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ['review-config', businessId] });
      const previousConfig = queryClient.getQueryData<ReviewConfig>(['review-config', businessId]);
      
      if (previousConfig) {
        queryClient.setQueryData(['review-config', businessId], {
          ...previousConfig,
          auto_request_enabled: enabled,
        });
      }

      return { previousConfig };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(['review-config', businessId], context.previousConfig);
      }
      toast.error('Failed to update setting');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['review-config', businessId], data);
      if (businessId) {
        setCachedConfig(businessId, data);
      }
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    updateConfig: upsertMutation.mutate,
    updateConfigAsync: upsertMutation.mutateAsync,
    isUpdating: upsertMutation.isPending,
    toggleAutoRequest: toggleAutoRequest.mutate,
    isToggling: toggleAutoRequest.isPending,
  };
}
