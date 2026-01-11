import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Haptic feedback utility
const triggerHaptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

interface PauseSubscriptionInput {
  subscriptionId: string;
  pauseStartDate: string;
  pauseEndDate?: string;
  reason?: string;
}

interface CancelSubscriptionInput {
  subscriptionId: string;
  reason?: string;
}

interface SkipVisitInput {
  scheduleId: string;
  reason?: string;
}

export function usePauseSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: PauseSubscriptionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('pause_subscription', {
        p_subscription_id: input.subscriptionId,
        p_pause_start_date: input.pauseStartDate,
        p_pause_end_date: input.pauseEndDate || null,
        p_reason: input.reason || null,
        p_paused_by: user.id,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (input) => {
      // Optimistic update for subscription status
      await queryClient.cancelQueries({ queryKey: ['subscription', input.subscriptionId] });

      const previousSubscription = queryClient.getQueryData(['subscription', input.subscriptionId]);

      queryClient.setQueryData(['subscription', input.subscriptionId], (old: any) => ({
        ...old,
        status: 'paused',
        pause_start_date: input.pauseStartDate,
        pause_end_date: input.pauseEndDate,
      }));

      return { previousSubscription };
    },
    onSuccess: () => {
      triggerHaptic(20);
      toast({
        title: 'Subscription paused',
        description: 'The subscription has been paused.',
      });
    },
    onError: (error, input, context) => {
      triggerHaptic([50, 50, 50]);
      if (context?.previousSubscription) {
        queryClient.setQueryData(['subscription', input.subscriptionId], context.previousSubscription);
      }
      toast({
        title: 'Error pausing subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: (_, __, input) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', input.subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] });
    },
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('resume_subscription', {
        p_subscription_id: subscriptionId,
        p_resumed_by: user.id,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (subscriptionId) => {
      await queryClient.cancelQueries({ queryKey: ['subscription', subscriptionId] });

      const previousSubscription = queryClient.getQueryData(['subscription', subscriptionId]);

      queryClient.setQueryData(['subscription', subscriptionId], (old: any) => ({
        ...old,
        status: 'active',
        pause_start_date: null,
        pause_end_date: null,
      }));

      return { previousSubscription };
    },
    onSuccess: () => {
      triggerHaptic(20);
      toast({
        title: 'Subscription resumed',
        description: 'The subscription is now active again.',
      });
    },
    onError: (error, subscriptionId, context) => {
      triggerHaptic([50, 50, 50]);
      if (context?.previousSubscription) {
        queryClient.setQueryData(['subscription', subscriptionId], context.previousSubscription);
      }
      toast({
        title: 'Error resuming subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: (_, __, subscriptionId) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CancelSubscriptionInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('cancel_subscription', {
        p_subscription_id: input.subscriptionId,
        p_reason: input.reason || null,
        p_cancelled_by: user.id,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['subscription', input.subscriptionId] });

      const previousSubscription = queryClient.getQueryData(['subscription', input.subscriptionId]);

      queryClient.setQueryData(['subscription', input.subscriptionId], (old: any) => ({
        ...old,
        status: 'cancelled',
        cancellation_reason: input.reason,
      }));

      return { previousSubscription };
    },
    onSuccess: (_, input) => {
      triggerHaptic(30);
      
      // Show toast with undo option (5-second window)
      toast({
        title: 'Subscription cancelled',
        description: 'The subscription has been cancelled.',
        // Note: Undo functionality would require additional backend support
        // to reverse cancellation within a time window
      });
    },
    onError: (error, input, context) => {
      triggerHaptic([50, 50, 50]);
      if (context?.previousSubscription) {
        queryClient.setQueryData(['subscription', input.subscriptionId], context.previousSubscription);
      }
      toast({
        title: 'Error cancelling subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: (_, __, input) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', input.subscriptionId] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] });
    },
  });
}

export function useSkipScheduledVisit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SkipVisitInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('skip_scheduled_visit', {
        p_schedule_id: input.scheduleId,
        p_reason: input.reason || null,
        p_skipped_by: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      triggerHaptic(10);
      toast({
        title: 'Visit skipped',
        description: 'The scheduled visit has been skipped.',
      });
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Error skipping visit',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] });
    },
  });
}

// Hook for regenerating schedules manually
export function useRegenerateSchedules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ subscriptionId, monthsAhead = 3 }: { subscriptionId: string; monthsAhead?: number }) => {
      const { data, error } = await supabase.rpc('generate_subscription_schedules', {
        p_subscription_id: subscriptionId,
        p_months_ahead: monthsAhead,
      });

      if (error) throw error;
      return data as number; // Returns count of schedules created
    },
    onSuccess: (count) => {
      triggerHaptic(10);
      toast({
        title: 'Schedules regenerated',
        description: `${count} new schedule(s) have been created.`,
      });
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Error regenerating schedules',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: (_, __, { subscriptionId }) => {
      queryClient.invalidateQueries({ queryKey: ['subscription', subscriptionId] });
    },
  });
}
