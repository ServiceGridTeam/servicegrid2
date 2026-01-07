import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessContext } from "./useBusinessContext";
import { toast } from "sonner";

export type RuleAction = "classify" | "spam" | "ignore" | "auto_reply";
export type ConditionOperator = "contains" | "not_contains" | "equals" | "starts_with" | "ends_with";
export type ConditionField = "subject" | "body" | "from";

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface EmailRule {
  id: string;
  business_id: string;
  connection_id: string | null;
  name: string;
  priority: number;
  is_active: boolean;
  conditions: RuleCondition[];
  action: RuleAction;
  action_config: Record<string, unknown>;
  created_from_correction: boolean;
  times_matched: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmailRules() {
  const { activeBusiness } = useBusinessContext();
  const businessId = activeBusiness?.id;

  return useQuery({
    queryKey: ["email-rules", businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("email_rules")
        .select("*")
        .eq("business_id", businessId)
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as EmailRule[];
    },
    enabled: !!businessId,
  });
}

export function useCreateEmailRule() {
  const queryClient = useQueryClient();
  const { activeBusiness } = useBusinessContext();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      conditions: RuleCondition[];
      action: RuleAction;
      connectionId?: string;
      priority?: number;
      createdFromCorrection?: boolean;
    }) => {
      if (!activeBusiness?.id) {
        throw new Error("No active business");
      }

      // Get max priority
      const { data: existingRules } = await supabase
        .from("email_rules")
        .select("priority")
        .eq("business_id", activeBusiness.id)
        .order("priority", { ascending: false })
        .limit(1);

      const maxPriority = existingRules?.[0]?.priority || 0;

      const { data, error } = await supabase
        .from("email_rules")
        .insert({
          business_id: activeBusiness.id,
          connection_id: params.connectionId || null,
          name: params.name,
          conditions: params.conditions,
          action: params.action,
          priority: params.priority ?? maxPriority + 1,
          created_from_correction: params.createdFromCorrection || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-rules"] });
      toast.success("Rule created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    },
  });
}

export function useUpdateEmailRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      ruleId: string;
      updates: Partial<Pick<EmailRule, "name" | "conditions" | "action" | "priority" | "is_active">>;
    }) => {
      const { data, error } = await supabase
        .from("email_rules")
        .update({
          ...params.updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.ruleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-rules"] });
      toast.success("Rule updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    },
  });
}

export function useDeleteEmailRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from("email_rules")
        .delete()
        .eq("id", ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-rules"] });
      toast.success("Rule deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete rule: ${error.message}`);
    },
  });
}

export function useReorderEmailRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update priorities based on new order (higher index = lower priority)
      const updates = orderedIds.map((id, index) => ({
        id,
        priority: orderedIds.length - index,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("email_rules")
          .update({ priority: update.priority, updated_at: update.updated_at })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-rules"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder rules: ${error.message}`);
    },
  });
}
