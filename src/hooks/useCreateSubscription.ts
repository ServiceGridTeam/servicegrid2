import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/hooks/useBusiness';

export interface SubscriptionLineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  sort_order?: number;
}

export interface CreateSubscriptionInput {
  customer_id: string;
  service_plan_id?: string;
  name: string;
  frequency: string;
  price: number;
  billing_type?: 'prepay' | 'per_visit';
  start_date: string;
  end_date?: string;
  auto_renew?: boolean;
  renewal_reminder_days?: number;
  internal_notes?: string;
  line_items?: SubscriptionLineItemInput[];
  activate_immediately?: boolean;
}

// Haptic feedback utility
const triggerHaptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: business } = useBusiness();

  return useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => {
      if (!business?.id) throw new Error('No business context');

      // Serialize line items to JSON for the RPC call
      const lineItemsJson = input.line_items?.map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: item.sort_order ?? index,
      })) || [];

      const { data, error } = await supabase.rpc('create_subscription', {
        p_business_id: business.id,
        p_customer_id: input.customer_id,
        p_service_plan_id: input.service_plan_id || null,
        p_name: input.name,
        p_frequency: input.frequency,
        p_price: input.price,
        p_billing_type: input.billing_type || 'prepay',
        p_start_date: input.start_date,
        p_end_date: input.end_date || null,
        p_auto_renew: input.auto_renew ?? true,
        p_renewal_reminder_days: input.renewal_reminder_days || 30,
        p_internal_notes: input.internal_notes || null,
        p_line_items: lineItemsJson,
        p_activate_immediately: input.activate_immediately ?? true,
      });

      if (error) throw error;
      return data as string; // Returns subscription ID
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['subscriptions', business?.id] });
    },
    onSuccess: (subscriptionId) => {
      triggerHaptic([10, 50, 20]);
      toast({
        title: 'Subscription created',
        description: 'The subscription has been created successfully.',
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] });

      return subscriptionId;
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Error creating subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Hook for updating an existing subscription
export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CreateSubscriptionInput>) => {
      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          name: updates.name,
          frequency: updates.frequency,
          price: updates.price,
          billing_type: updates.billing_type,
          start_date: updates.start_date,
          end_date: updates.end_date,
          auto_renew: updates.auto_renew,
          renewal_reminder_days: updates.renewal_reminder_days,
          internal_notes: updates.internal_notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      triggerHaptic(10);
      toast({
        title: 'Subscription updated',
        description: 'The subscription has been updated successfully.',
      });

      queryClient.invalidateQueries({ queryKey: ['subscription', data.id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-subscriptions'] });
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Error updating subscription',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
