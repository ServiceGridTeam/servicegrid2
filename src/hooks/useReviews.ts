import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { toast } from 'sonner';

export interface Review {
  id: string;
  business_id: string;
  customer_id: string | null;
  job_id: string | null;
  review_request_id: string | null;
  assigned_technician_id: string | null;
  rating: number;
  nps_score: number | null;
  feedback_text: string | null;
  feedback_sentiment: 'positive' | 'neutral' | 'negative' | null;
  feedback_key_phrases: string[];
  technician_rating: number | null;
  timeliness_rating: number | null;
  quality_rating: number | null;
  value_rating: number | null;
  is_public: boolean;
  platform: 'google' | 'yelp' | 'facebook' | 'internal' | null;
  external_review_id: string | null;
  external_review_url: string | null;
  response_text: string | null;
  response_suggested: string | null;
  responded_at: string | null;
  responded_by: string | null;
  is_featured: boolean;
  display_name: string | null;
  display_approved: boolean;
  source: 'request' | 'portal' | 'import' | 'aggregated';
  created_at: string;
  updated_at: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  job?: {
    title: string;
    actual_end: string | null;
  } | null;
  technician?: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface ReviewFilters {
  rating?: number;
  platform?: string;
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasResponse?: boolean;
}

export function useReviews(filters: ReviewFilters = {}) {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  const query = useQuery({
    queryKey: ['reviews', businessId, filters],
    queryFn: async (): Promise<Review[]> => {
      if (!businessId) return [];

      let queryBuilder = supabase
        .from('reviews')
        .select(`
          *,
          customer:customers(first_name, last_name, email),
          job:jobs(title, actual_end),
          technician:profiles!reviews_assigned_technician_id_fkey(first_name, last_name)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (filters.rating) {
        queryBuilder = queryBuilder.eq('rating', filters.rating);
      }

      if (filters.platform) {
        queryBuilder = queryBuilder.eq('platform', filters.platform);
      }

      if (filters.technicianId) {
        queryBuilder = queryBuilder.eq('assigned_technician_id', filters.technicianId);
      }

      if (filters.dateFrom) {
        queryBuilder = queryBuilder.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        queryBuilder = queryBuilder.lte('created_at', filters.dateTo);
      }

      if (filters.hasResponse !== undefined) {
        if (filters.hasResponse) {
          queryBuilder = queryBuilder.not('response_text', 'is', null);
        } else {
          queryBuilder = queryBuilder.is('response_text', null);
        }
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Failed to fetch reviews:', error);
        throw error;
      }

      return (data || []) as Review[];
    },
    enabled: !!businessId,
    staleTime: 60 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel('reviews-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['reviews', businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  return {
    reviews: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useReview(reviewId: string | null) {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ['review', reviewId],
    queryFn: async (): Promise<Review | null> => {
      if (!reviewId) return null;

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          customer:customers(first_name, last_name, email),
          job:jobs(title, actual_end, description),
          technician:profiles!reviews_assigned_technician_id_fkey(first_name, last_name)
        `)
        .eq('id', reviewId)
        .single();

      if (error) {
        console.error('Failed to fetch review:', error);
        throw error;
      }

      return data as Review;
    },
    enabled: !!reviewId && !!businessId,
  });
}

export function useSubmitReviewResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, responseText }: { reviewId: string; responseText: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('reviews')
        .update({
          response_text: responseText,
          responded_at: new Date().toISOString(),
          responded_by: user?.id || null,
        })
        .eq('id', reviewId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', variables.reviewId] });
      toast.success('Response saved');
    },
    onError: () => {
      toast.error('Failed to save response');
    },
  });
}

export function useGenerateReviewResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, tone }: { reviewId: string; tone?: 'professional' | 'friendly' | 'empathetic' }) => {
      const { data, error } = await supabase.functions.invoke('generate-review-response', {
        body: { reviewId, tone },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to generate response');
      }

      return data.suggestedResponse as string;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['review', variables.reviewId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to generate response');
    },
  });
}

export function useToggleFeaturedReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, isFeatured }: { reviewId: string; isFeatured: boolean }) => {
      const { error } = await supabase
        .from('reviews')
        .update({ is_featured: isFeatured })
        .eq('id', reviewId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: () => {
      toast.error('Failed to update review');
    },
  });
}
