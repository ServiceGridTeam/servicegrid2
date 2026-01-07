import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessContext } from "./useBusinessContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

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
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ["email-rules", activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId) return [];

      const { data, error } = await supabase
        .from("email_rules")
        .select("*")
        .eq("business_id", activeBusinessId)
        .order("priority", { ascending: false });

      if (error) throw error;
      return (data as unknown) as EmailRule[];
    },
    enabled: !!activeBusinessId,
  });
}

export function useCreateEmailRule() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      conditions: RuleCondition[];
      action: RuleAction;
      connectionId?: string;
      priority?: number;
      createdFromCorrection?: boolean;
    }) => {
      if (!activeBusinessId) {
        throw new Error("No active business");
      }

      // Get max priority
      const { data: existingRules } = await supabase
        .from("email_rules")
        .select("priority")
        .eq("business_id", activeBusinessId)
        .order("priority", { ascending: false })
        .limit(1);

      const maxPriority = existingRules?.[0]?.priority || 0;

      const insertData = {
        business_id: activeBusinessId,
        connection_id: params.connectionId || null,
        name: params.name,
        conditions: params.conditions as unknown as Json,
        action: params.action,
        priority: params.priority ?? maxPriority + 1,
        created_from_correction: params.createdFromCorrection || false,
      };

      const { data, error } = await supabase
        .from("email_rules")
        .insert(insertData)
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
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (params.updates.name !== undefined) updatePayload.name = params.updates.name;
      if (params.updates.action !== undefined) updatePayload.action = params.updates.action;
      if (params.updates.priority !== undefined) updatePayload.priority = params.updates.priority;
      if (params.updates.is_active !== undefined) updatePayload.is_active = params.updates.is_active;
      if (params.updates.conditions !== undefined) {
        updatePayload.conditions = params.updates.conditions as unknown as Record<string, unknown>;
      }

      const { data, error } = await supabase
        .from("email_rules")
        .update(updatePayload)
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
