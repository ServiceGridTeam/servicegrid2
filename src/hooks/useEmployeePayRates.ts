import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "./useBusiness";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { format } from "date-fns";

export type EmployeePayRate = Tables<"employee_pay_rates">;

export interface PayRateWithEmployee extends EmployeePayRate {
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

// Get all current pay rates for the business
export function useEmployeePayRates() {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["employee-pay-rates", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("employee_pay_rates")
        .select(`
          *,
          user:profiles!employee_pay_rates_user_id_fkey(id, first_name, last_name, email, avatar_url)
        `)
        .eq("business_id", business.id)
        .is("effective_to", null)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PayRateWithEmployee[];
    },
    enabled: !!business?.id,
  });
}

// Get pay rate for a specific user
export function useEmployeePayRate(userId: string | undefined) {
  const { data: business } = useBusiness();
  const today = format(new Date(), "yyyy-MM-dd");
  
  return useQuery({
    queryKey: ["employee-pay-rates", "user", userId, today],
    queryFn: async () => {
      if (!userId || !business?.id) return null;
      
      const { data, error } = await supabase
        .from("employee_pay_rates")
        .select("*")
        .eq("business_id", business.id)
        .eq("user_id", userId)
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!business?.id,
  });
}

// Get pay rate history for a user
export function usePayRateHistory(userId: string | undefined) {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["employee-pay-rates", "history", userId],
    queryFn: async () => {
      if (!userId || !business?.id) return [];
      
      const { data, error } = await supabase
        .from("employee_pay_rates")
        .select("*")
        .eq("business_id", business.id)
        .eq("user_id", userId)
        .order("effective_from", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!business?.id,
  });
}

// Create or update pay rate
export function useUpsertPayRate() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      hourlyRate: number;
      overtimeRate?: number;
      doubletimeRate?: number;
      billRate?: number;
      effectiveFrom?: Date;
    }) => {
      if (!business?.id) throw new Error("No business found");
      
      const effectiveFrom = params.effectiveFrom 
        ? format(params.effectiveFrom, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");
      
      // Close out any existing current rate
      const { data: existingRates } = await supabase
        .from("employee_pay_rates")
        .select("id")
        .eq("business_id", business.id)
        .eq("user_id", params.userId)
        .is("effective_to", null);
      
      if (existingRates && existingRates.length > 0) {
        // Close out existing rates
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        await supabase
          .from("employee_pay_rates")
          .update({
            effective_to: format(yesterday, "yyyy-MM-dd"),
            is_current: false,
          })
          .in("id", existingRates.map(r => r.id));
      }
      
      // Create new rate
      const { data, error } = await supabase
        .from("employee_pay_rates")
        .insert({
          business_id: business.id,
          user_id: params.userId,
          hourly_rate: params.hourlyRate,
          overtime_rate: params.overtimeRate,
          double_time_rate: params.doubletimeRate,
          bill_rate: params.billRate,
          effective_from: effectiveFrom,
          is_current: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-pay-rates"] });
    },
  });
}

// Delete pay rate
export function useDeletePayRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rateId: string) => {
      const { error } = await supabase
        .from("employee_pay_rates")
        .delete()
        .eq("id", rateId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-pay-rates"] });
    },
  });
}

// Calculate labor cost for given hours
export function calculateLaborCost(
  hours: number,
  regularRate: number,
  overtimeRate?: number | null,
  doubletimeRate?: number | null,
  overtimeHours: number = 0,
  doubletimeHours: number = 0
): number {
  const regularHours = Math.max(0, hours - overtimeHours - doubletimeHours);
  
  const effectiveOvertimeRate = overtimeRate ?? regularRate * 1.5;
  const effectiveDoubletimeRate = doubletimeRate ?? regularRate * 2;
  
  const regularCost = regularHours * regularRate;
  const overtimeCost = overtimeHours * effectiveOvertimeRate;
  const doubletimeCost = doubletimeHours * effectiveDoubletimeRate;
  
  return regularCost + overtimeCost + doubletimeCost;
}
