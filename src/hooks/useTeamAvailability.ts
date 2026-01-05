import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TeamAvailability, WeeklySchedule, DAY_NAMES } from "@/types/routePlanning";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

const DAY_NAME_LIST = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function useTeamAvailability(userId?: string) {
  return useQuery({
    queryKey: ["team-availability", userId],
    queryFn: async () => {
      let query = supabase
        .from("team_availability")
        .select("*")
        .order("day_of_week", { ascending: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TeamAvailability[];
    },
  });
}

export function useMyAvailability() {
  return useQuery({
    queryKey: ["team-availability", "me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("team_availability")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_week", { ascending: true });

      if (error) throw error;
      return data as TeamAvailability[];
    },
  });
}

export function useWeeklySchedule(userId: string | undefined) {
  return useQuery({
    queryKey: ["weekly-schedule", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("team_availability")
        .select("*")
        .eq("user_id", userId)
        .order("day_of_week", { ascending: true });

      if (error) throw error;

      // Build full weekly schedule, filling in defaults for missing days
      const schedule = DAY_NAME_LIST.map((dayName, dayOfWeek) => {
        const existing = data?.find((a) => a.day_of_week === dayOfWeek);
        return {
          dayOfWeek,
          dayName,
          startTime: existing?.start_time || "08:00",
          endTime: existing?.end_time || "17:00",
          isAvailable: existing?.is_available ?? (dayOfWeek >= 1 && dayOfWeek <= 5),
        };
      });

      return {
        userId,
        schedule,
      } as WeeklySchedule;
    },
    enabled: !!userId,
  });
}

export function useUpsertAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (availability: Omit<TablesInsert<"team_availability">, "business_id">) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profile?.business_id) throw new Error("Business not found");

      const { data, error } = await supabase
        .from("team_availability")
        .upsert(
          {
            ...availability,
            business_id: profile.business_id,
          },
          {
            onConflict: "user_id,day_of_week",
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["team-availability"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule", data.user_id] });
    },
  });
}

export function useBulkUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      schedules,
    }: {
      userId: string;
      schedules: {
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        isAvailable: boolean;
      }[];
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profile?.business_id) throw new Error("Business not found");

      const records = schedules.map((s) => ({
        user_id: userId,
        business_id: profile.business_id,
        day_of_week: s.dayOfWeek,
        start_time: s.startTime,
        end_time: s.endTime,
        is_available: s.isAvailable,
      }));

      const { data, error } = await supabase
        .from("team_availability")
        .upsert(records, { onConflict: "user_id,day_of_week" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team-availability"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule", variables.userId] });
    },
  });
}

export function useDeleteAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-availability"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-schedule"] });
    },
  });
}

// Helper to check if a user is available on a specific date
export function useIsUserAvailable(userId: string | undefined, date: Date | undefined) {
  const dayOfWeek = date?.getDay();
  
  return useQuery({
    queryKey: ["user-available", userId, date?.toISOString()],
    queryFn: async () => {
      if (!userId || dayOfWeek === undefined) return false;

      // Check availability for this day of week
      const { data: availability } = await supabase
        .from("team_availability")
        .select("is_available")
        .eq("user_id", userId)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      // Default to available Mon-Fri if no record exists
      if (!availability) {
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      }

      return availability.is_available;
    },
    enabled: !!userId && !!date,
  });
}
