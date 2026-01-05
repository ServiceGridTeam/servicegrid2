import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PublicJobData {
  id: string;
  title: string;
  status: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  assigned_to: string | null;
  worker_name?: string;
  drive_time_from_previous: number | null;
}

export function usePublicJobTracking(token: string | undefined) {
  const [realtimeData, setRealtimeData] = useState<PublicJobData | null>(null);

  const query = useQuery({
    queryKey: ["public-job-tracking", token],
    queryFn: async (): Promise<PublicJobData | null> => {
      if (!token) return null;

      const { data, error } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          status,
          scheduled_start,
          scheduled_end,
          estimated_arrival,
          actual_arrival,
          address_line1,
          city,
          state,
          assigned_to,
          drive_time_from_previous
        `)
        .eq("tracking_token", token)
        .single();

      if (error) {
        console.error("Error fetching job tracking:", error);
        return null;
      }

      // Fetch worker name if assigned
      let workerName: string | undefined;
      if (data?.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", data.assigned_to)
          .single();
        
        if (profile) {
          workerName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Technician";
        }
      }

      return { ...data, worker_name: workerName } as PublicJobData;
    },
    enabled: !!token,
    staleTime: 30000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!token || !query.data?.id) return;

    console.log("[usePublicJobTracking] Subscribing to realtime updates for job:", query.data.id);

    const channel = supabase
      .channel(`job-tracking-${query.data.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${query.data.id}`,
        },
        (payload) => {
          console.log("[usePublicJobTracking] Realtime update received:", payload);
          const updated = payload.new as PublicJobData;
          setRealtimeData((prev) => ({
            ...prev,
            ...updated,
            worker_name: prev?.worker_name,
          }));
        }
      )
      .subscribe();

    return () => {
      console.log("[usePublicJobTracking] Unsubscribing from realtime");
      supabase.removeChannel(channel);
    };
  }, [token, query.data?.id]);

  // Merge query data with realtime updates
  const data = realtimeData
    ? { ...query.data, ...realtimeData }
    : query.data;

  return {
    data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
