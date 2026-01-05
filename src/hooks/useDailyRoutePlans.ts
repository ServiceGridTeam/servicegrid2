import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DailyRoutePlan } from "@/types/routePlanning";
import type { TablesInsert, TablesUpdate, Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export interface RoutePlanWithWorker extends DailyRoutePlan {
  user: Pick<Profile, "id" | "first_name" | "last_name" | "avatar_url"> | null;
}

interface UseRoutePlansOptions {
  userId?: string;
  date?: Date;
  dateFrom?: Date;
  dateTo?: Date;
}

export function useDailyRoutePlans(options?: UseRoutePlansOptions) {
  return useQuery({
    queryKey: ["daily-route-plans", options],
    queryFn: async () => {
      let query = supabase
        .from("daily_route_plans")
        .select("*")
        .order("route_date", { ascending: true });

      if (options?.userId) {
        query = query.eq("user_id", options.userId);
      }

      if (options?.date) {
        const dateStr = options.date.toISOString().split("T")[0];
        query = query.eq("route_date", dateStr);
      }

      if (options?.dateFrom) {
        query = query.gte("route_date", options.dateFrom.toISOString().split("T")[0]);
      }

      if (options?.dateTo) {
        query = query.lte("route_date", options.dateTo.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DailyRoutePlan[];
    },
  });
}

export function useDailyRoutePlan(id: string | undefined) {
  return useQuery({
    queryKey: ["daily-route-plans", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("daily_route_plans")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as DailyRoutePlan | null;
    },
    enabled: !!id,
  });
}

export function useRoutePlanForUserDate(userId: string | undefined, date: Date | undefined) {
  const dateStr = date?.toISOString().split("T")[0];
  
  return useQuery({
    queryKey: ["daily-route-plans", "user-date", userId, dateStr],
    queryFn: async () => {
      if (!userId || !dateStr) return null;
      const { data, error } = await supabase
        .from("daily_route_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("route_date", dateStr)
        .maybeSingle();
      if (error) throw error;
      return data as DailyRoutePlan | null;
    },
    enabled: !!userId && !!date,
  });
}

export function useDailyRoutePlansForDate(date: Date | undefined) {
  const dateStr = date?.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["daily-route-plans", "all-workers", dateStr],
    queryFn: async () => {
      if (!dateStr) return [];

      const { data, error } = await supabase
        .from("daily_route_plans")
        .select(`
          *,
          user:profiles!user_id(id, first_name, last_name, avatar_url)
        `)
        .eq("route_date", dateStr)
        .order("user_id");

      if (error) throw error;
      return data as RoutePlanWithWorker[];
    },
    enabled: !!date,
  });
}

export function useCreateRoutePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (plan: Omit<TablesInsert<"daily_route_plans">, "business_id">) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profile?.business_id) throw new Error("Business not found");

      const { data, error } = await supabase
        .from("daily_route_plans")
        .insert({
          ...plan,
          business_id: profile.business_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
    },
  });
}

export function useUpdateRoutePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"daily_route_plans"> & { id: string }) => {
      const { data, error } = await supabase
        .from("daily_route_plans")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans", data.id] });
    },
  });
}

export function useDeleteRoutePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_route_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
    },
  });
}
