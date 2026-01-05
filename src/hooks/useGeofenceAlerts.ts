import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useEffect } from "react";

export interface GeofenceAlert {
  id: string;
  business_id: string;
  clock_event_id: string;
  job_id: string;
  user_id: string;
  alert_type: string;
  severity: string;
  distance_meters: number;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface GeofenceAlertWithDetails extends GeofenceAlert {
  user?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  job?: {
    job_number: string;
    title: string | null;
  };
}

export function useGeofenceAlerts(status: "pending" | "acknowledged" | "all" = "pending") {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["geofence-alerts", status, profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return [];

      let query = supabase
        .from("geofence_alerts")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user profiles separately since there's no direct FK
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch jobs separately
      const jobIds = [...new Set(data.map(a => a.job_id))];
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, job_number, title")
        .in("id", jobIds);

      const jobMap = new Map(jobs?.map(j => [j.id, j]) || []);

      return data.map(alert => ({
        ...alert,
        user: profileMap.get(alert.user_id),
        job: jobMap.get(alert.job_id),
      })) as GeofenceAlertWithDetails[];
    },
    enabled: !!profile?.business_id,
  });
}

export function usePendingAlertsCount() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["geofence-alerts", "count", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return 0;

      const { count, error } = await supabase
        .from("geofence_alerts")
        .select("*", { count: "exact", head: true })
        .eq("business_id", profile.business_id)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.business_id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("geofence_alerts")
        .update({
          status: "acknowledged",
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq("id", alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofence-alerts"] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("geofence_alerts")
        .delete()
        .eq("id", alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofence-alerts"] });
    },
  });
}

// Hook to subscribe to realtime alerts
export function useGeofenceAlertsRealtime(onNewAlert?: (alert: GeofenceAlert) => void) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel("geofence-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "geofence_alerts",
          filter: `business_id=eq.${profile.business_id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["geofence-alerts"] });
          if (onNewAlert) {
            onNewAlert(payload.new as GeofenceAlert);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id, queryClient, onNewAlert]);
}
