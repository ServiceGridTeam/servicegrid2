import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from '@/lib/portalLocalState';

const PREFETCH_DELAY_MS = 150;

export function usePortalPrefetch() {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetchDashboard = useCallback(async (businessId: string, customerId: string) => {
    const sessionToken = getPortalSessionToken();
    if (!sessionToken) return;

    await queryClient.prefetchQuery({
      queryKey: ['portal-dashboard', businessId, customerId],
      queryFn: async () => {
        // Fetch quotes
        const { data: quotes } = await supabase
          .from('quotes')
          .select('id, status, total')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .in('status', ['sent', 'pending']);

        // Fetch invoices
        const { data: invoices } = await supabase
          .from('invoices')
          .select('id, status, balance_due')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .in('status', ['sent', 'partial', 'overdue']);

        // Fetch jobs
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, scheduled_start, status')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .gte('scheduled_start', new Date().toISOString())
          .order('scheduled_start', { ascending: true })
          .limit(5);

        const pendingQuotes = quotes?.length || 0;
        const unpaidInvoices = invoices?.length || 0;
        const totalOwed = invoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0;

        return {
          pendingQuotes,
          unpaidInvoices,
          activeJobs: jobs?.filter(j => j.status === 'in_progress').length || 0,
          totalOwed,
          upcomingJobs: jobs?.map(j => ({
            id: j.id,
            title: j.title,
            scheduledDate: j.scheduled_start || '',
            status: j.status || 'scheduled',
          })) || [],
        };
      },
      staleTime: 60 * 1000, // 1 minute
    });
  }, [queryClient]);

  const createHoverHandler = useCallback((businessId: string, customerId: string) => {
    return {
      onMouseEnter: () => {
        timeoutRef.current = setTimeout(() => {
          prefetchDashboard(businessId, customerId);
        }, PREFETCH_DELAY_MS);
      },
      onMouseLeave: () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      },
    };
  }, [prefetchDashboard]);

  return {
    prefetchDashboard,
    createHoverHandler,
  };
}

export default usePortalPrefetch;
