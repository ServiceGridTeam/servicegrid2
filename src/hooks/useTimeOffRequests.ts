import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TimeOffRequest, TimeOffStatus } from "@/types/routePlanning";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

interface UseTimeOffOptions {
  userId?: string;
  status?: TimeOffStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

type TimeOffRequestWithUser = TimeOffRequest & {
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  approver?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export function useTimeOffRequests(options?: UseTimeOffOptions) {
  return useQuery({
    queryKey: ["time-off-requests", options],
    queryFn: async () => {
      let query = supabase
        .from("time_off_requests")
        .select(`
          *,
          user:profiles!time_off_requests_user_id_fkey(id, first_name, last_name, email),
          approver:profiles!time_off_requests_approved_by_fkey(id, first_name, last_name)
        `)
        .order("start_date", { ascending: true });

      if (options?.userId) {
        query = query.eq("user_id", options.userId);
      }

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.dateFrom) {
        query = query.gte("end_date", options.dateFrom.toISOString().split("T")[0]);
      }

      if (options?.dateTo) {
        query = query.lte("start_date", options.dateTo.toISOString().split("T")[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TimeOffRequestWithUser[];
    },
  });
}

export function useMyTimeOffRequests() {
  return useQuery({
    queryKey: ["time-off-requests", "me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as TimeOffRequest[];
    },
  });
}

export function usePendingTimeOffRequests() {
  return useQuery({
    queryKey: ["time-off-requests", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select(`
          *,
          user:profiles!time_off_requests_user_id_fkey(id, first_name, last_name, email)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TimeOffRequestWithUser[];
    },
  });
}

export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: Pick<TablesInsert<"time_off_requests">, "start_date" | "end_date" | "reason">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", user.id)
        .single();

      if (!profile?.business_id) throw new Error("Business not found");

      const { data, error } = await supabase
        .from("time_off_requests")
        .insert({
          ...request,
          user_id: user.id,
          business_id: profile.business_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

export function useApproveTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_off_requests")
        .update({
          status: "approved",
          approved_by: user.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

export function useRejectTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("time_off_requests")
        .update({
          status: "rejected",
          approved_by: user.id,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

export function useDeleteTimeOffRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
    },
  });
}

// Helper to check if a user has time off on a specific date
export function useHasTimeOff(userId: string | undefined, date: Date | undefined) {
  const dateStr = date?.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["has-time-off", userId, dateStr],
    queryFn: async () => {
      if (!userId || !dateStr) return false;

      const { data, error } = await supabase
        .from("time_off_requests")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .lte("start_date", dateStr)
        .gte("end_date", dateStr)
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!userId && !!date,
  });
}

// Get all users with approved time off on a specific date
export function useUsersWithTimeOff(date: Date | undefined) {
  const dateStr = date?.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["users-with-time-off", dateStr],
    queryFn: async () => {
      if (!dateStr) return [];

      const { data, error } = await supabase
        .from("time_off_requests")
        .select("user_id")
        .eq("status", "approved")
        .lte("start_date", dateStr)
        .gte("end_date", dateStr);

      if (error) throw error;
      return data?.map((r) => r.user_id) ?? [];
    },
    enabled: !!date,
  });
}
