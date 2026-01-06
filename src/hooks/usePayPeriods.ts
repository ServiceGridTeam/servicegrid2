import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "./useBusiness";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export type PayPeriod = Tables<"pay_periods">;

// Get all pay periods for the business
export function usePayPeriods() {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["pay-periods", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("pay_periods")
        .select("*")
        .eq("business_id", business.id)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });
}

// Get current/active pay period
export function useCurrentPayPeriod() {
  const { data: business } = useBusiness();
  const today = format(new Date(), "yyyy-MM-dd");
  
  return useQuery({
    queryKey: ["pay-periods", "current", business?.id, today],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data, error } = await supabase
        .from("pay_periods")
        .select("*")
        .eq("business_id", business.id)
        .lte("start_date", today)
        .gte("end_date", today)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });
}

// Get pay period by ID
export function usePayPeriod(payPeriodId: string | undefined) {
  return useQuery({
    queryKey: ["pay-periods", payPeriodId],
    queryFn: async () => {
      if (!payPeriodId) return null;
      
      const { data, error } = await supabase
        .from("pay_periods")
        .select("*")
        .eq("id", payPeriodId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!payPeriodId,
  });
}

// Generate pay period(s) via edge function
export function useGeneratePayPeriod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      periodType?: "weekly" | "biweekly" | "semimonthly" | "monthly";
      startDate?: Date;
      count?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-pay-periods", {
        body: {
          periodType: params.periodType || "weekly",
          startDate: params.startDate?.toISOString().split("T")[0],
          count: params.count || 1,
        },
      });
      
      if (error) throw error;
      return data.periods;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-periods"] });
    },
  });
}

// Lock pay period
export function useLockPayPeriod() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (payPeriodId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("pay_periods")
        .update({
          status: "locked",
          locked_at: new Date().toISOString(),
          locked_by: user.id,
        })
        .eq("id", payPeriodId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-periods"] });
    },
  });
}

// Unlock pay period
export function useUnlockPayPeriod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payPeriodId: string) => {
      const { data, error } = await supabase
        .from("pay_periods")
        .update({
          status: "open",
          locked_at: null,
          locked_by: null,
        })
        .eq("id", payPeriodId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-periods"] });
    },
  });
}

// Update pay period totals
export function useUpdatePayPeriodTotals() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      payPeriodId: string;
      totalHours: number;
      totalRegularHours: number;
      totalOvertimeHours: number;
      totalLaborCost: number;
    }) => {
      const { data, error } = await supabase
        .from("pay_periods")
        .update({
          total_hours: params.totalHours,
          total_regular_hours: params.totalRegularHours,
          total_overtime_hours: params.totalOvertimeHours,
          total_labor_cost: params.totalLaborCost,
        })
        .eq("id", params.payPeriodId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pay-periods"] });
    },
  });
}
