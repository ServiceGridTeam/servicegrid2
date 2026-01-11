import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AutomationRule = Database['public']['Tables']['automation_rules']['Row'];

export interface AutomationRuleConfig {
  interval_days?: number;
  max_reminders?: number;
}

export interface AutomationRuleWithConfig extends Omit<AutomationRule, 'action_config' | 'trigger_config'> {
  action_config: AutomationRuleConfig | null;
  trigger_config: Record<string, unknown> | null;
}

// Query keys
export const automationRulesKeys = {
  all: ['automation-rules'] as const,
  list: (businessId: string) => [...automationRulesKeys.all, 'list', businessId] as const,
  detail: (id: string) => [...automationRulesKeys.all, 'detail', id] as const,
};

// Fetch all automation rules for the current business
export function useAutomationRules() {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: automationRulesKeys.list(activeBusinessId || ''),
    queryFn: async () => {
      if (!activeBusinessId) return [];

      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('business_id', activeBusinessId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AutomationRuleWithConfig[];
    },
    enabled: !!activeBusinessId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Fetch a single automation rule
export function useAutomationRule(ruleId: string | undefined) {
  return useQuery({
    queryKey: automationRulesKeys.detail(ruleId || ''),
    queryFn: async () => {
      if (!ruleId) return null;

      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('id', ruleId)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as AutomationRuleWithConfig;
    },
    enabled: !!ruleId,
    staleTime: 30 * 1000,
  });
}

// Toggle automation rule active state
export function useToggleAutomationRule() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('automation_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ ruleId, isActive }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: automationRulesKeys.list(activeBusinessId || '') });

      // Snapshot previous value
      const previousRules = queryClient.getQueryData<AutomationRuleWithConfig[]>(
        automationRulesKeys.list(activeBusinessId || '')
      );

      // Optimistically update
      if (previousRules) {
        queryClient.setQueryData<AutomationRuleWithConfig[]>(
          automationRulesKeys.list(activeBusinessId || ''),
          previousRules.map(rule =>
            rule.id === ruleId ? { ...rule, is_active: isActive } : rule
          )
        );
      }

      // Haptic feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(isActive ? [10, 50, 10] : [10]); // Success pattern vs light
      }

      return { previousRules };
    },
    onError: (err, { ruleId, isActive }, context) => {
      // Rollback on error
      if (context?.previousRules) {
        queryClient.setQueryData(
          automationRulesKeys.list(activeBusinessId || ''),
          context.previousRules
        );
      }
      toast({
        variant: 'destructive',
        title: 'Failed to update automation',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSuccess: (_, { isActive }) => {
      toast({
        title: isActive ? 'Automation enabled' : 'Automation disabled',
        description: isActive
          ? 'Reminders will be sent automatically for overdue invoices'
          : 'Automatic reminders have been paused',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.list(activeBusinessId || '') });
    },
  });
}

// Update automation rule config
export function useUpdateAutomationConfig() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async ({ ruleId, config }: { ruleId: string; config: Partial<AutomationRuleConfig> }) => {
      // Fetch current config first
      const { data: currentRule, error: fetchError } = await supabase
        .from('automation_rules')
        .select('action_config')
        .eq('id', ruleId)
        .single();

      if (fetchError) throw fetchError;

      const currentConfig = (currentRule?.action_config as AutomationRuleConfig) || {};
      const mergedConfig = { ...currentConfig, ...config };

      const { data, error } = await supabase
        .from('automation_rules')
        .update({
          action_config: mergedConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ ruleId, config }) => {
      await queryClient.cancelQueries({ queryKey: automationRulesKeys.list(activeBusinessId || '') });

      const previousRules = queryClient.getQueryData<AutomationRuleWithConfig[]>(
        automationRulesKeys.list(activeBusinessId || '')
      );

      if (previousRules) {
        queryClient.setQueryData<AutomationRuleWithConfig[]>(
          automationRulesKeys.list(activeBusinessId || ''),
          previousRules.map(rule =>
            rule.id === ruleId
              ? { ...rule, action_config: { ...rule.action_config, ...config } }
              : rule
          )
        );
      }

      // Light haptic feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }

      return { previousRules };
    },
    onError: (err, _, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(
          automationRulesKeys.list(activeBusinessId || ''),
          context.previousRules
        );
      }
      toast({
        variant: 'destructive',
        title: 'Failed to update settings',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.list(activeBusinessId || '') });
    },
  });
}

// Soft delete automation rule
export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('automation_rules')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id,
          is_active: false,
        })
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: automationRulesKeys.list(activeBusinessId || '') });
      toast({ title: 'Automation deleted' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Failed to delete automation',
        description: err instanceof Error ? err.message : 'An error occurred',
      });
    },
  });
}
