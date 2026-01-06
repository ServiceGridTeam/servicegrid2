/**
 * Hook to prefetch data for a business on hover
 * Reduces perceived latency when switching businesses
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePrefetch() {
  const queryClient = useQueryClient();

  /**
   * Prefetch dashboard data for a business
   */
  const prefetchBusiness = useCallback(
    async (businessId: string) => {
      // Prefetch dashboard stats
      await queryClient.prefetchQuery({
        queryKey: ['dashboard-stats', businessId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('jobs')
            .select('id, status', { count: 'exact' })
            .eq('business_id', businessId)
            .limit(1);

          if (error) throw error;
          return data;
        },
        staleTime: 30 * 1000, // 30 seconds
      });

      // Prefetch recent jobs
      await queryClient.prefetchQuery({
        queryKey: ['jobs', businessId, 'recent'],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('jobs')
            .select('id, title, status, scheduled_start')
            .eq('business_id', businessId)
            .order('scheduled_start', { ascending: false })
            .limit(5);

          if (error) throw error;
          return data;
        },
        staleTime: 30 * 1000,
      });
    },
    [queryClient]
  );

  /**
   * Create a hover handler for prefetching
   */
  const createHoverHandler = useCallback(
    (businessId: string) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      return {
        onMouseEnter: () => {
          // Delay prefetch by 150ms to avoid unnecessary fetches
          timeoutId = setTimeout(() => {
            prefetchBusiness(businessId);
          }, 150);
        },
        onMouseLeave: () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        },
      };
    },
    [prefetchBusiness]
  );

  return {
    prefetchBusiness,
    createHoverHandler,
  };
}
