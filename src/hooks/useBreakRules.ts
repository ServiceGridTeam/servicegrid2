import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "./useBusiness";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type BreakRule = Tables<"break_rules">;

// Get all break rules for the business
export function useBreakRules() {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["break-rules", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("break_rules")
        .select("*")
        .eq("business_id", business.id)
        .order("trigger_hours", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });
}

// Get active break rules
export function useActiveBreakRules() {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["break-rules", "active", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("break_rules")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .order("trigger_hours", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!business?.id,
  });
}

// Create break rule
export function useCreateBreakRule() {
  const queryClient = useQueryClient();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      name: string;
      triggerHours: number;
      deductionMinutes: number;
      isPaid?: boolean;
      isAutomatic?: boolean;
    }) => {
      if (!business?.id) throw new Error("No business found");
      
      const { data, error } = await supabase
        .from("break_rules")
        .insert({
          business_id: business.id,
          name: params.name,
          trigger_hours: params.triggerHours,
          deduction_minutes: params.deductionMinutes,
          is_paid: params.isPaid ?? false,
          is_automatic: params.isAutomatic ?? true,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-rules"] });
    },
  });
}

// Update break rule
export function useUpdateBreakRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      triggerHours?: number;
      deductionMinutes?: number;
      isPaid?: boolean;
      isAutomatic?: boolean;
      isActive?: boolean;
    }) => {
      const { id, ...updates } = params;
      
      const updateData: Partial<BreakRule> = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.triggerHours !== undefined) updateData.trigger_hours = updates.triggerHours;
      if (updates.deductionMinutes !== undefined) updateData.deduction_minutes = updates.deductionMinutes;
      if (updates.isPaid !== undefined) updateData.is_paid = updates.isPaid;
      if (updates.isAutomatic !== undefined) updateData.is_automatic = updates.isAutomatic;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      const { data, error } = await supabase
        .from("break_rules")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-rules"] });
    },
  });
}

// Delete break rule
export function useDeleteBreakRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("break_rules")
        .delete()
        .eq("id", ruleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["break-rules"] });
    },
  });
}

// Calculate break deduction for a shift
export function calculateBreakDeduction(
  durationMinutes: number,
  breakRules: BreakRule[]
): { totalDeductionMinutes: number; appliedRules: BreakRule[] } {
  const activeRules = breakRules.filter(r => r.is_active && r.is_automatic);
  const appliedRules: BreakRule[] = [];
  let totalDeductionMinutes = 0;
  
  for (const rule of activeRules) {
    // Convert trigger_hours to minutes for comparison
    const triggerMinutes = rule.trigger_hours * 60;
    
    if (durationMinutes >= triggerMinutes) {
      totalDeductionMinutes += rule.deduction_minutes;
      appliedRules.push(rule);
    }
  }
  
  return { totalDeductionMinutes, appliedRules };
}
