import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";

export interface PhoneIntegrationLog {
  id: string;
  integration_id: string;
  business_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_code: string | null;
  duration_ms: number | null;
  request_metadata: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface LogStats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  endpoints: Record<string, number>;
}

/**
 * Fetch API logs for a phone integration with realtime updates
 */
export function usePhoneIntegrationLogs(integrationId: string | undefined, limit = 100) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const query = useQuery({
    queryKey: ["phone-integration-logs", integrationId, limit],
    queryFn: async () => {
      if (!integrationId) return [];

      const { data, error } = await supabase
        .from("phone_integration_logs")
        .select("*")
        .eq("integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as PhoneIntegrationLog[];
    },
    enabled: !!integrationId,
  });

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!integrationId) return;

    const channel = supabase
      .channel(`phone-logs-${integrationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "phone_integration_logs",
          filter: `integration_id=eq.${integrationId}`,
        },
        (payload) => {
          // Add new log to the top of the list
          queryClient.setQueryData(
            ["phone-integration-logs", integrationId, limit],
            (oldData: PhoneIntegrationLog[] | undefined) => {
              if (!oldData) return [payload.new as PhoneIntegrationLog];
              // Keep only latest 'limit' entries
              return [payload.new as PhoneIntegrationLog, ...oldData].slice(0, limit);
            }
          );
          // Also invalidate stats to recalculate
          queryClient.invalidateQueries({
            queryKey: ["phone-integration-stats", integrationId],
          });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [integrationId, limit, queryClient]);

  return { ...query, isConnected };
}

/**
 * Fetch aggregated stats for phone integration logs
 */
export function usePhoneIntegrationStats(integrationId: string | undefined) {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["phone-integration-stats", integrationId],
    queryFn: async (): Promise<LogStats> => {
      if (!integrationId || !profile?.business_id) {
        return {
          total_requests: 0,
          success_count: 0,
          error_count: 0,
          avg_duration_ms: 0,
          endpoints: {},
        };
      }

      // Get logs from the last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data, error } = await supabase
        .from("phone_integration_logs")
        .select("status_code, duration_ms, endpoint")
        .eq("integration_id", integrationId)
        .gte("created_at", yesterday.toISOString());

      if (error) throw error;

      const logs = data || [];
      const successCount = logs.filter((l) => l.status_code >= 200 && l.status_code < 300).length;
      const errorCount = logs.filter((l) => l.status_code >= 400).length;
      const totalDuration = logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0);
      const avgDuration = logs.length > 0 ? Math.round(totalDuration / logs.length) : 0;

      // Count by endpoint
      const endpoints: Record<string, number> = {};
      logs.forEach((l) => {
        endpoints[l.endpoint] = (endpoints[l.endpoint] || 0) + 1;
      });

      return {
        total_requests: logs.length,
        success_count: successCount,
        error_count: errorCount,
        avg_duration_ms: avgDuration,
        endpoints,
      };
    },
    enabled: !!integrationId && !!profile?.business_id,
    refetchInterval: 60000, // Refresh every minute
  });
}
