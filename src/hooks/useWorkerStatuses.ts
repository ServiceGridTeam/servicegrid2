import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";

export type WorkerStatus = Tables<"worker_statuses"> & {
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
  current_job?: {
    id: string;
    title: string;
    job_number: string;
    address_line1: string | null;
    city: string | null;
  } | null;
};

export function useWorkerStatuses() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["worker-statuses"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .single();

      if (!profile?.business_id) return [];

      // Fetch worker statuses
      const { data: statuses, error } = await supabase
        .from("worker_statuses")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!statuses) return [];

      // Fetch profiles and jobs separately
      const userIds = statuses.map((s) => s.user_id);
      const jobIds = statuses.filter((s) => s.current_job_id).map((s) => s.current_job_id!);

      const [profilesResult, jobsResult] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, avatar_url, email").in("id", userIds),
        jobIds.length > 0
          ? supabase.from("jobs").select("id, title, job_number, address_line1, city").in("id", jobIds)
          : { data: [] },
      ]);

      const profilesMap = new Map(
        (profilesResult.data || []).map((p) => [p.id, p])
      );
      const jobsMap = new Map(
        (jobsResult.data || []).map((j) => [j.id, j])
      );

      return statuses.map((status) => ({
        ...status,
        profile: profilesMap.get(status.user_id) || null,
        current_job: status.current_job_id ? jobsMap.get(status.current_job_id) || null : null,
      })) as WorkerStatus[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("worker-statuses-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "worker_statuses",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["worker-statuses"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useUpdateWorkerStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      status,
      jobId,
      latitude,
      longitude,
    }: {
      userId: string;
      status: string;
      jobId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .single();

      if (!profile?.business_id) throw new Error("No business found");

      const { data, error } = await supabase
        .from("worker_statuses")
        .upsert({
          user_id: userId,
          business_id: profile.business_id,
          current_status: status,
          current_job_id: jobId,
          current_location_lat: latitude,
          current_location_lng: longitude,
          last_location_at: latitude ? new Date().toISOString() : undefined,
          status_since: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-statuses"] });
    },
  });
}
