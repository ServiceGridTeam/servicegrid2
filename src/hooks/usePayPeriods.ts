import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "./useBusiness";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { startOfWeek, endOfWeek, addWeeks, addDays, format } from "date-fns";

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

// Generate pay period(s)
export function useGeneratePayPeriod() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      periodType?: "weekly" | "biweekly" | "semimonthly" | "monthly";
      startDate?: Date;
      count?: number;
    }) => {
      if (!business?.id) throw new Error("No business found");
      
      const periodType = params.periodType || "weekly";
      const count = params.count || 1;
      const periods: TablesInsert<"pay_periods">[] = [];
      
      // Find the last pay period to continue from
      const { data: lastPeriod } = await supabase
        .from("pay_periods")
        .select("end_date")
        .eq("business_id", business.id)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let startDate = params.startDate 
        ? new Date(params.startDate)
        : lastPeriod 
          ? addDays(new Date(lastPeriod.end_date), 1)
          : startOfWeek(new Date(), { weekStartsOn: 0 });
      
      for (let i = 0; i < count; i++) {
        let endDate: Date;
        
        switch (periodType) {
          case "weekly":
            endDate = addDays(startDate, 6);
            break;
          case "biweekly":
            endDate = addDays(startDate, 13);
            break;
          case "semimonthly":
            // 1-15 or 16-end of month
            if (startDate.getDate() <= 15) {
              endDate = new Date(startDate.getFullYear(), startDate.getMonth(), 15);
            } else {
              endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            }
            break;
          case "monthly":
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            break;
          default:
            endDate = addDays(startDate, 6);
        }
        
        periods.push({
          business_id: business.id,
          period_type: periodType,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          status: "open",
        });
        
        startDate = addDays(endDate, 1);
      }
      
      const { data, error } = await supabase
        .from("pay_periods")
        .insert(periods)
        .select();
      
      if (error) throw error;
      return data;
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
