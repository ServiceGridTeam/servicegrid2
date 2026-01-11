import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PortalSubscription {
  id: string;
  subscription_number: string;
  name: string;
  status: string;
  frequency: string;
  price: number;
  next_service_date: string | null;
  upcoming_schedules: PortalSchedule[];
}

export interface PortalSchedule {
  id: string;
  scheduled_date: string;
  status: string;
}

// Haptic feedback utility
const triggerHaptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export function usePortalSubscriptions(customerId: string | undefined, businessId: string | undefined) {
  return useQuery({
    queryKey: ['portal-subscriptions', customerId, businessId],
    queryFn: async () => {
      if (!customerId || !businessId) return [];

      const { data, error } = await supabase.rpc('portal_get_subscriptions', {
        p_customer_id: customerId,
        p_business_id: businessId,
      });

      if (error) throw error;

      // Parse the JSONB result
      const subscriptions = typeof data === 'string' ? JSON.parse(data) : data;
      return subscriptions as PortalSubscription[];
    },
    enabled: !!customerId && !!businessId,
    staleTime: 60000,
  });
}

export function usePortalSkipVisit(customerId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, reason }: { scheduleId: string; reason?: string }) => {
      if (!customerId) throw new Error('No customer context');

      const { data, error } = await supabase.rpc('portal_skip_visit', {
        p_schedule_id: scheduleId,
        p_customer_id: customerId,
        p_reason: reason || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      triggerHaptic(10);
      toast({
        title: 'Visit skipped',
        description: 'Your scheduled visit has been skipped.',
      });
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Unable to skip visit',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-subscriptions'] });
    },
  });
}

// Hook for getting single subscription details in portal
export function usePortalSubscriptionDetail(
  subscriptionId: string | undefined,
  customerId: string | undefined,
  businessId: string | undefined
) {
  const { data: subscriptions, ...rest } = usePortalSubscriptions(customerId, businessId);

  const subscription = subscriptions?.find((s) => s.id === subscriptionId);

  return {
    data: subscription,
    ...rest,
  };
}

// Hook for customer to view their upcoming schedules across all subscriptions
export function usePortalUpcomingSchedules(customerId: string | undefined, businessId: string | undefined) {
  const { data: subscriptions, isLoading, error } = usePortalSubscriptions(customerId, businessId);

  // Flatten and sort all upcoming schedules
  const upcomingSchedules = subscriptions
    ?.flatMap((sub) =>
      (sub.upcoming_schedules || []).map((schedule) => ({
        ...schedule,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
      }))
    )
    .filter((s) => s.status === 'pending')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()) || [];

  return {
    data: upcomingSchedules,
    isLoading,
    error,
  };
}
