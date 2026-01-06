import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getPortalDashboardCache,
  setPortalDashboardCache,
  StoredDashboardCache,
} from '@/lib/portalLocalState';
import { usePortalSession } from './usePortalSession';
import { usePortalPreview } from '@/contexts/PortalPreviewContext';

interface UsePortalDashboardOptions {
  businessId?: string | null;
  customerId?: string | null;
}

export function usePortalDashboard(options?: UsePortalDashboardOptions) {
  const session = usePortalSession();
  const preview = usePortalPreview();
  
  // Use provided overrides, then preview context, then session
  const activeBusinessId = options?.businessId ?? preview.businessId ?? session.activeBusinessId;
  const activeCustomerId = options?.customerId ?? preview.customerId ?? session.activeCustomerId;
  const isAuthenticated = preview.isPreviewMode || session.isAuthenticated;

  // Get cached data for instant hydration
  const cachedData = getPortalDashboardCache();

  const query = useQuery({
    queryKey: ['portal-dashboard', activeBusinessId, activeCustomerId],
    queryFn: async (): Promise<StoredDashboardCache> => {
      if (!activeBusinessId || !activeCustomerId) {
        throw new Error('No active business or customer');
      }

      // Fetch quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id, status, total')
        .eq('business_id', activeBusinessId)
        .eq('customer_id', activeCustomerId)
        .in('status', ['sent', 'pending']);

      if (quotesError) throw quotesError;

      // Fetch invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, status, balance_due')
        .eq('business_id', activeBusinessId)
        .eq('customer_id', activeCustomerId)
        .in('status', ['sent', 'partial', 'overdue']);

      if (invoicesError) throw invoicesError;

      // Fetch upcoming jobs
      const today = new Date().toISOString();
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, scheduled_start, status')
        .eq('business_id', activeBusinessId)
        .eq('customer_id', activeCustomerId)
        .gte('scheduled_start', today)
        .order('scheduled_start', { ascending: true })
        .limit(5);

      if (jobsError) throw jobsError;

      const dashboardData: StoredDashboardCache = {
        pendingQuotes: quotes?.length || 0,
        unpaidInvoices: invoices?.length || 0,
        activeJobs: jobs?.filter(j => j.status === 'in_progress').length || 0,
        totalOwed: invoices?.reduce((sum, inv) => sum + (inv.balance_due || 0), 0) || 0,
        upcomingJobs: jobs?.map(j => ({
          id: j.id,
          title: j.title,
          scheduledDate: j.scheduled_start || '',
          status: j.status || 'scheduled',
        })) || [],
      };

      // Cache the data for next time
      setPortalDashboardCache(dashboardData);

      return dashboardData;
    },
    enabled: isAuthenticated && !!activeBusinessId && !!activeCustomerId,
    staleTime: 60 * 1000, // 1 minute
    // Use cached data as initial data for instant hydration
    initialData: cachedData || undefined,
    initialDataUpdatedAt: cachedData ? Date.now() - 30000 : undefined, // Treat as 30s old to trigger refresh
  });

  return {
    // Return cached data immediately, then fresh data when available
    data: query.data || cachedData || {
      pendingQuotes: 0,
      unpaidInvoices: 0,
      activeJobs: 0,
      totalOwed: 0,
      upcomingJobs: [],
    },
    isLoading: query.isLoading && !cachedData,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export default usePortalDashboard;
