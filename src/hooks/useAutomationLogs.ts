import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';

export type AutomationLogStatus = 'success' | 'failed' | 'skipped';

export interface AutomationLog {
  id: string;
  business_id: string;
  rule_id: string | null;
  rule_name: string;
  trigger_type: string;
  action_type: string;
  target_type: string;
  target_id: string;
  status: AutomationLogStatus;
  result: Record<string, unknown> | null;
  idempotency_key: string | null;
  cron_run_id: string | null;
  created_at: string;
}

export interface UseAutomationLogsOptions {
  status?: AutomationLogStatus | 'all';
  ruleId?: string;
  limit?: number;
  page?: number;
}

// Query keys
export const automationLogsKeys = {
  all: ['automation-logs'] as const,
  list: (businessId: string, options?: UseAutomationLogsOptions) =>
    [...automationLogsKeys.all, 'list', businessId, options] as const,
};

export function useAutomationLogs(options: UseAutomationLogsOptions = {}) {
  const { activeBusinessId } = useBusinessContext();
  const { status = 'all', ruleId, limit = 50, page = 0 } = options;

  return useQuery({
    queryKey: automationLogsKeys.list(activeBusinessId || '', options),
    queryFn: async () => {
      if (!activeBusinessId) return { logs: [], count: 0 };

      let query = supabase
        .from('automation_logs')
        .select('*', { count: 'exact' })
        .eq('business_id', activeBusinessId)
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (ruleId) {
        query = query.eq('rule_id', ruleId);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        logs: (data || []) as AutomationLog[],
        count: count || 0,
      };
    },
    enabled: !!activeBusinessId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
  });
}

// Get log stats for a rule
export function useAutomationLogStats(ruleId: string | undefined) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: [...automationLogsKeys.all, 'stats', ruleId],
    queryFn: async () => {
      if (!activeBusinessId || !ruleId) {
        return { success: 0, failed: 0, skipped: 0, total: 0 };
      }

      // Get counts by status for the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('automation_logs')
        .select('status')
        .eq('business_id', activeBusinessId)
        .eq('rule_id', ruleId)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      const stats = {
        success: 0,
        failed: 0,
        skipped: 0,
        total: data?.length || 0,
      };

      for (const log of data || []) {
        if (log.status === 'success') stats.success++;
        else if (log.status === 'failed') stats.failed++;
        else if (log.status === 'skipped') stats.skipped++;
      }

      return stats;
    },
    enabled: !!activeBusinessId && !!ruleId,
    staleTime: 30 * 1000,
  });
}

// Subscribe to realtime log updates
export function useAutomationLogsRealtime(onNewLog: (log: AutomationLog) => void) {
  const { activeBusinessId } = useBusinessContext();

  // Set up realtime subscription
  // Note: This should be called within a useEffect in the component
  const subscribe = () => {
    if (!activeBusinessId) return null;

    const channel = supabase
      .channel('automation-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_logs',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => {
          onNewLog(payload.new as AutomationLog);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return { subscribe };
}
