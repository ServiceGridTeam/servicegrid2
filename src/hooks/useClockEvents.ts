import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ClockEvent = Tables<"clock_events"> & {
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function useClockEvents(jobId: string | undefined) {
  return useQuery({
    queryKey: ["clock-events", jobId],
    queryFn: async () => {
      if (!jobId) return [];

      // Fetch clock events
      const { data: events, error } = await supabase
        .from("clock_events")
        .select("*")
        .eq("job_id", jobId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      if (!events) return [];

      // Fetch profiles separately
      const userIds = [...new Set(events.map((e) => e.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      return events.map((event) => ({
        ...event,
        profile: profilesMap.get(event.user_id) || null,
      })) as ClockEvent[];
    },
    enabled: !!jobId,
  });
}
