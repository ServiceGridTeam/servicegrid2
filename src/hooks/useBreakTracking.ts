import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateWorkerStatus } from "./useWorkerStatuses";

// Check if user has an active break entry for a specific job
export function useActiveBreakEntry(jobId: string) {
  return useQuery({
    queryKey: ["active-break-entry", jobId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .eq("entry_type", "break")
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

// Start a break - clocks out current work entry and creates a break entry
export function useStartBreak() {
  const queryClient = useQueryClient();
  const updateWorkerStatus = useUpdateWorkerStatus();

  return useMutation({
    mutationFn: async (params: {
      jobId: string;
      businessId: string;
      currentWorkEntryId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // 1. Clock out the current work entry
      const { data: workEntry, error: workError } = await supabase
        .from("time_entries")
        .select("clock_in")
        .eq("id", params.currentWorkEntryId)
        .single();

      if (workError) throw workError;

      const clockInTime = new Date(workEntry.clock_in);
      const clockOutTime = new Date(now);
      const durationMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000);

      const { error: clockOutError } = await supabase
        .from("time_entries")
        .update({
          clock_out: now,
          duration_minutes: durationMinutes,
        })
        .eq("id", params.currentWorkEntryId);

      if (clockOutError) throw clockOutError;

      // 2. Create a new break entry
      const { data: breakEntry, error: breakError } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          job_id: params.jobId,
          business_id: params.businessId,
          entry_type: "break",
          clock_in: now,
          is_billable: false,
        })
        .select()
        .single();

      if (breakError) throw breakError;

      // 3. Update worker status to on_break
      await updateWorkerStatus.mutateAsync({
        userId: user.id,
        status: "on_break",
        jobId: params.jobId,
      });

      return breakEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["active-time-entry-for-job", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["active-break-entry", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["worker-statuses"] });
    },
  });
}

// End a break - clocks out break entry and creates a new work entry
export function useEndBreak() {
  const queryClient = useQueryClient();
  const updateWorkerStatus = useUpdateWorkerStatus();

  return useMutation({
    mutationFn: async (params: {
      jobId: string;
      businessId: string;
      breakEntryId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const now = new Date().toISOString();

      // 1. Clock out the break entry
      const { data: breakEntry, error: breakFetchError } = await supabase
        .from("time_entries")
        .select("clock_in")
        .eq("id", params.breakEntryId)
        .single();

      if (breakFetchError) throw breakFetchError;

      const clockInTime = new Date(breakEntry.clock_in);
      const clockOutTime = new Date(now);
      const durationMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000);

      const { error: breakClockOutError } = await supabase
        .from("time_entries")
        .update({
          clock_out: now,
          duration_minutes: durationMinutes,
        })
        .eq("id", params.breakEntryId);

      if (breakClockOutError) throw breakClockOutError;

      // 2. Create a new work entry to resume work
      const { data: workEntry, error: workError } = await supabase
        .from("time_entries")
        .insert({
          user_id: user.id,
          job_id: params.jobId,
          business_id: params.businessId,
          entry_type: "work",
          clock_in: now,
          is_billable: true,
        })
        .select()
        .single();

      if (workError) throw workError;

      // 3. Update worker status back to clocked_in/on_site
      await updateWorkerStatus.mutateAsync({
        userId: user.id,
        status: "on_site",
        jobId: params.jobId,
      });

      return workEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["active-time-entry-for-job", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["active-break-entry", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["worker-statuses"] });
    },
  });
}
