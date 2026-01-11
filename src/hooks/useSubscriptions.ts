import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/hooks/useBusiness';
import type { Database } from '@/integrations/supabase/types';

// Use actual database types
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type SubscriptionScheduleRow = Database['public']['Tables']['subscription_schedules']['Row'];
type SubscriptionItemRow = Database['public']['Tables']['subscription_items']['Row'];

export type SubscriptionSchedule = SubscriptionScheduleRow;
export type SubscriptionLineItem = SubscriptionItemRow;

export interface Subscription extends SubscriptionRow {
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  };
  service_plan?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  subscription_items?: SubscriptionLineItem[];
  subscription_schedules?: SubscriptionSchedule[];
}

export interface SubscriptionFilters {
  status?: string;
  customerId?: string;
  search?: string;
}

export function useSubscriptions(filters: SubscriptionFilters = {}) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['subscriptions', business?.id, filters],
    queryFn: async () => {
      if (!business?.id) return [];

      let query = supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, company_name),
          service_plan:service_plans(id, name, description)
        `)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,subscription_number.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Subscription[];
    },
    enabled: !!business?.id,
    staleTime: 30000,
  });
}

export function useSubscription(id: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['subscription', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, company_name),
          service_plan:service_plans(id, name, description),
          subscription_items(*),
          subscription_schedules(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Sort schedules by date client-side
      const result = data as unknown as Subscription;
      if (result.subscription_schedules) {
        result.subscription_schedules = [...result.subscription_schedules].sort(
          (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
        );
      }

      // Sort items by sort_order
      if (result.subscription_items) {
        result.subscription_items = [...result.subscription_items].sort(
          (a, b) => a.sort_order - b.sort_order
        );
      }

      return result;
    },
    enabled: !!id && !!business?.id,
  });
}

export function useCustomerSubscriptions(customerId: string | undefined) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ['customer-subscriptions', customerId, business?.id],
    queryFn: async () => {
      if (!customerId || !business?.id) return [];

      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          service_plan:service_plans(id, name, description),
          subscription_schedules(*)
        `)
        .eq('customer_id', customerId)
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Sort schedules for each subscription
      return (data as unknown as Subscription[]).map((sub) => ({
        ...sub,
        subscription_schedules: sub.subscription_schedules
          ? [...sub.subscription_schedules].sort(
              (a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
            )
          : [],
      }));
    },
    enabled: !!customerId && !!business?.id,
    staleTime: 30000,
  });
}

// Helper to get upcoming schedules count
export function useUpcomingSchedulesCount(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ['subscription-upcoming-count', subscriptionId],
    queryFn: async () => {
      if (!subscriptionId) return 0;

      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('subscription_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', subscriptionId)
        .eq('status', 'pending')
        .gte('scheduled_date', today);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!subscriptionId,
  });
}
