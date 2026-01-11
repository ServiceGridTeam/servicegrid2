import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useBusiness } from '@/hooks/useBusiness';
import type { Database } from '@/integrations/supabase/types';

// Use the actual database type
type ServicePlanRow = Database['public']['Tables']['service_plans']['Row'];

export type ServicePlan = ServicePlanRow;

interface CreateServicePlanInput {
  name: string;
  description?: string;
  default_frequency: string;
  base_price: number;
  is_active?: boolean;
}

interface UpdateServicePlanInput {
  id: string;
  name?: string;
  description?: string;
  default_frequency?: string;
  base_price?: number;
  is_active?: boolean;
}

// Haptic feedback utility
const triggerHaptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

export function useServicePlans(includeInactive = false) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['service-plans', business?.id, includeInactive],
    queryFn: async () => {
      if (!business?.id) return [];

      let query = supabase
        .from('service_plans')
        .select('*')
        .eq('business_id', business.id)
        .order('name');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServicePlan[];
    },
    enabled: !!business?.id,
    staleTime: 30000,
  });
}

export function useServicePlan(id: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['service-plan', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('service_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ServicePlan;
    },
    enabled: !!id && !!business?.id,
  });
}

export function useCreateServicePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: business } = useBusiness();

  return useMutation({
    mutationFn: async (input: CreateServicePlanInput) => {
      if (!business?.id) throw new Error('No business context');

      const { data, error } = await supabase
        .from('service_plans')
        .insert([{
          business_id: business.id,
          name: input.name,
          description: input.description || null,
          default_frequency: input.default_frequency,
          base_price: input.base_price,
          is_active: input.is_active ?? true,
          billing_model: 'flat_rate',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      triggerHaptic([10, 50, 20]);
      toast({
        title: 'Service plan created',
        description: 'The service plan has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['service-plans'] });
    },
    onError: (error) => {
      triggerHaptic([50, 50, 50]);
      toast({
        title: 'Error creating service plan',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateServicePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: business } = useBusiness();

  return useMutation({
    mutationFn: async (input: UpdateServicePlanInput) => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('service_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ServicePlan;
    },
    onMutate: async (updatedPlan) => {
      await queryClient.cancelQueries({ queryKey: ['service-plans', business?.id] });
      await queryClient.cancelQueries({ queryKey: ['service-plan', updatedPlan.id] });

      const previousPlans = queryClient.getQueryData<ServicePlan[]>(['service-plans', business?.id, false]);
      const previousPlan = queryClient.getQueryData<ServicePlan>(['service-plan', updatedPlan.id]);

      // Optimistic update in list
      if (previousPlans) {
        queryClient.setQueryData<ServicePlan[]>(
          ['service-plans', business?.id, false],
          previousPlans.map((plan) =>
            plan.id === updatedPlan.id ? { ...plan, ...updatedPlan } : plan
          )
        );
      }

      // Optimistic update for single plan
      if (previousPlan) {
        queryClient.setQueryData<ServicePlan>(['service-plan', updatedPlan.id], {
          ...previousPlan,
          ...updatedPlan,
        });
      }

      return { previousPlans, previousPlan };
    },
    onSuccess: () => {
      triggerHaptic(10);
      toast({
        title: 'Service plan updated',
        description: 'The service plan has been updated successfully.',
      });
    },
    onError: (error, updatedPlan, context) => {
      triggerHaptic([50, 50, 50]);
      if (context?.previousPlans) {
        queryClient.setQueryData(['service-plans', business?.id, false], context.previousPlans);
      }
      if (context?.previousPlan) {
        queryClient.setQueryData(['service-plan', updatedPlan.id], context.previousPlan);
      }
      toast({
        title: 'Error updating service plan',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['service-plans'] });
    },
  });
}

export function useDeleteServicePlan() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: business } = useBusiness();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('service_plans')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['service-plans', business?.id] });

      const previousPlans = queryClient.getQueryData<ServicePlan[]>(['service-plans', business?.id, false]);

      // Optimistically remove from active list
      if (previousPlans) {
        queryClient.setQueryData<ServicePlan[]>(
          ['service-plans', business?.id, false],
          previousPlans.filter((plan) => plan.id !== deletedId)
        );
      }

      return { previousPlans };
    },
    onSuccess: () => {
      triggerHaptic(30);
      toast({
        title: 'Service plan archived',
        description: 'The service plan has been archived.',
      });
    },
    onError: (error, _, context) => {
      triggerHaptic([50, 50, 50]);
      if (context?.previousPlans) {
        queryClient.setQueryData(['service-plans', business?.id, false], context.previousPlans);
      }
      toast({
        title: 'Error archiving service plan',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['service-plans'] });
    },
  });
}
