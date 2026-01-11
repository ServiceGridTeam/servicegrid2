import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import { addDays, format } from 'date-fns';

export interface SubscriptionStats {
  activeCount: number;
  pausedCount: number;
  monthlyRecurringRevenue: number;
  upcomingServicesCount: number;
  pendingInvoicesCount: number;
}

export interface UpcomingService {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  customerName: string;
  scheduledDate: string;
  status: string;
}

export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  eventType: string;
  createdAt: string;
  actorName: string | null;
  details: Record<string, unknown> | null;
}

export function useSubscriptionStats() {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['subscription-stats', business?.id],
    queryFn: async () => {
      if (!business?.id) return null;

      const { data, error } = await supabase.rpc('get_subscription_stats', {
        p_business_id: business.id,
      });

      if (error) throw error;

      // Handle both array and single object responses
      let stats: Record<string, unknown>;
      if (Array.isArray(data)) {
        stats = data.length > 0 ? data[0] : {};
      } else {
        stats = data || {};
      }

      return {
        activeCount: Number(stats.active_count || 0),
        pausedCount: Number(stats.paused_count || 0),
        monthlyRecurringRevenue: Number(stats.monthly_recurring_revenue || 0),
        upcomingServicesCount: Number(stats.upcoming_services_count || 0),
        pendingInvoicesCount: Number(stats.pending_invoices_count || 0),
      } as SubscriptionStats;
    },
    enabled: !!business?.id,
    staleTime: 60000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpcomingServices(daysAhead = 14) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['upcoming-services', business?.id, daysAhead],
    queryFn: async () => {
      if (!business?.id) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), daysAhead), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('subscription_schedules')
        .select(`
          id,
          scheduled_date,
          status,
          subscription:subscriptions(
            id,
            name,
            customer:customers(first_name, last_name)
          )
        `)
        .eq('business_id', business.id)
        .eq('status', 'pending')
        .gte('scheduled_date', today)
        .lte('scheduled_date', endDate)
        .order('scheduled_date')
        .limit(20);

      if (error) throw error;

      return (data || []).map((schedule: unknown) => {
        const s = schedule as {
          id: string;
          scheduled_date: string;
          status: string;
          subscription?: {
            id: string;
            name: string;
            customer?: { first_name: string; last_name: string };
          };
        };
        return {
          id: s.id,
          subscriptionId: s.subscription?.id || '',
          subscriptionName: s.subscription?.name || 'Unknown',
          customerName: s.subscription?.customer
            ? `${s.subscription.customer.first_name} ${s.subscription.customer.last_name}`
            : 'Unknown Customer',
          scheduledDate: s.scheduled_date,
          status: s.status,
        };
      }) as UpcomingService[];
    },
    enabled: !!business?.id,
    staleTime: 60000,
  });
}

export function useRecentSubscriptionEvents(limit = 10) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['subscription-events', business?.id, limit],
    queryFn: async () => {
      if (!business?.id) return [];

      const { data, error } = await supabase
        .from('subscription_events')
        .select(`
          id,
          subscription_id,
          event_type,
          created_at,
          actor_id,
          details,
          actor:profiles(first_name, last_name)
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((event: unknown) => {
        const e = event as {
          id: string;
          subscription_id: string;
          event_type: string;
          created_at: string;
          actor_id: string | null;
          details: Record<string, unknown> | null;
          actor?: { first_name: string; last_name: string };
        };
        return {
          id: e.id,
          subscriptionId: e.subscription_id,
          eventType: e.event_type,
          createdAt: e.created_at,
          actorName: e.actor
            ? `${e.actor.first_name} ${e.actor.last_name}`
            : null,
          details: e.details,
        };
      }) as SubscriptionEvent[];
    },
    enabled: !!business?.id,
    staleTime: 30000,
  });
}

// Combined dashboard hook for progressive loading
export function useSubscriptionDashboard() {
  const stats = useSubscriptionStats();
  const upcomingServices = useUpcomingServices();
  const recentEvents = useRecentSubscriptionEvents();

  return {
    stats: stats.data,
    upcomingServices: upcomingServices.data || [],
    recentEvents: recentEvents.data || [],
    isLoading: stats.isLoading || upcomingServices.isLoading || recentEvents.isLoading,
    isError: stats.isError || upcomingServices.isError || recentEvents.isError,
    error: stats.error || upcomingServices.error || recentEvents.error,
    // Progressive loading states
    statsLoaded: !stats.isLoading,
    servicesLoaded: !upcomingServices.isLoading,
    eventsLoaded: !recentEvents.isLoading,
  };
}
