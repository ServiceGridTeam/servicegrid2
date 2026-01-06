import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type TimeEntry = Tables<"time_entries">;

export interface TimeEntryWithDetails extends TimeEntry {
  job: {
    id: string;
    job_number: string;
    title: string | null;
    customer: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Get active time entry for current user (any job)
export function useActiveTimeEntry() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["time-entries", "active", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          job:jobs(id, job_number, title, customer:customers(first_name, last_name))
        `)
        .eq("user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as TimeEntryWithDetails | null;
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute for live timer
  });
}

// Get active time entry for a specific job
export function useActiveTimeEntryForJob(jobId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["time-entries", "active", "job", jobId, user?.id],
    queryFn: async () => {
      if (!user?.id || !jobId) return null;
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .is("clock_out", null)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!jobId,
    refetchInterval: 60000,
  });
}

// Get all time entries for a job
export function useTimeEntriesForJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ["time-entries", "job", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      
      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          user:profiles(id, first_name, last_name, avatar_url)
        `)
        .eq("job_id", jobId)
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data as (TimeEntry & { user: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; } | null })[];
    },
    enabled: !!jobId,
  });
}

// Get time entries for a date range (for timesheets)
export function useTimeEntriesForDateRange(
  startDate: Date,
  endDate: Date,
  userId?: string
) {
  return useQuery({
    queryKey: ["time-entries", "range", startDate.toISOString(), endDate.toISOString(), userId],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          job:jobs(id, job_number, title, customer:customers(first_name, last_name)),
          user:profiles(id, first_name, last_name, avatar_url)
        `)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .order("clock_in", { ascending: false });
      
      if (userId) {
        query = query.eq("user_id", userId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as TimeEntryWithDetails[];
    },
  });
}

// Get team stats for dashboard
export function useTeamTimeStats() {
  return useQuery({
    queryKey: ["time-entries", "team-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      
      // Get today's entries
      const { data: todayEntries, error: todayError } = await supabase
        .from("time_entries")
        .select(`
          *,
          user:profiles(id, first_name, last_name, avatar_url),
          job:jobs(id, job_number, title, customer:customers(first_name, last_name))
        `)
        .gte("clock_in", today.toISOString())
        .lt("clock_in", tomorrow.toISOString());
      
      if (todayError) throw todayError;
      
      // Get active entries (currently clocked in)
      const { data: activeEntries, error: activeError } = await supabase
        .from("time_entries")
        .select(`
          *,
          user:profiles(id, first_name, last_name, avatar_url),
          job:jobs(id, job_number, title, customer:customers(first_name, last_name))
        `)
        .is("clock_out", null);
      
      if (activeError) throw activeError;
      
      // Get this week's entries for summary
      const { data: weekEntries, error: weekError } = await supabase
        .from("time_entries")
        .select("user_id, duration_minutes")
        .gte("clock_in", weekStart.toISOString())
        .not("duration_minutes", "is", null);
      
      if (weekError) throw weekError;
      
      // Calculate total hours logged today
      const todayMinutes = (todayEntries || []).reduce((sum, entry) => {
        if (entry.duration_minutes) {
          return sum + entry.duration_minutes;
        }
        if (!entry.clock_out) {
          // Still active, calculate from clock_in to now
          const clockIn = new Date(entry.clock_in);
          const now = new Date();
          return sum + Math.floor((now.getTime() - clockIn.getTime()) / 60000);
        }
        return sum;
      }, 0);
      
      // Calculate weekly hours by user
      const weeklyByUser = (weekEntries || []).reduce((acc, entry) => {
        if (!acc[entry.user_id]) {
          acc[entry.user_id] = 0;
        }
        acc[entry.user_id] += entry.duration_minutes || 0;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        activeEntries: activeEntries as TimeEntryWithDetails[],
        todayEntries: todayEntries as TimeEntryWithDetails[],
        todayHours: todayMinutes / 60,
        weeklyByUser,
      };
    },
  });
}

// Clock in mutation
export function useClockIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (params: { 
      jobId: string; 
      businessId: string;
      entryType?: string;
      notes?: string;
      // GPS coordinates
      clockInLatitude?: number;
      clockInLongitude?: number;
      locationAccuracy?: number;
      // Link to clock_events
      clockInEventId?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          job_id: params.jobId,
          business_id: params.businessId,
          user_id: user.id,
          entry_type: params.entryType || "work",
          notes: params.notes,
          clock_in_latitude: params.clockInLatitude,
          clock_in_longitude: params.clockInLongitude,
          location_accuracy: params.locationAccuracy,
          clock_in_event_id: params.clockInEventId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// Clock out mutation
export function useClockOut() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { 
      entryId: string;
      notes?: string;
      // GPS coordinates
      clockOutLatitude?: number;
      clockOutLongitude?: number;
      locationAccuracy?: number;
      // Link to clock_events
      clockOutEventId?: string;
    }) => {
      // First get the entry to calculate duration
      const { data: entry, error: fetchError } = await supabase
        .from("time_entries")
        .select("clock_in")
        .eq("id", params.entryId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const clockIn = new Date(entry.clock_in);
      const clockOut = new Date();
      const durationMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
      
      const { data, error } = await supabase
        .from("time_entries")
        .update({
          clock_out: clockOut.toISOString(),
          duration_minutes: durationMinutes,
          notes: params.notes,
          clock_out_latitude: params.clockOutLatitude,
          clock_out_longitude: params.clockOutLongitude,
          clock_out_event_id: params.clockOutEventId,
        })
        .eq("id", params.entryId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// Update time entry
export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { 
      id: string;
      clock_in?: string;
      clock_out?: string;
      notes?: string;
      entry_type?: string;
    }) => {
      const { id, ...updates } = params;
      
      // Recalculate duration if times changed
      if (updates.clock_in || updates.clock_out) {
        const { data: entry, error: fetchError } = await supabase
          .from("time_entries")
          .select("clock_in, clock_out")
          .eq("id", id)
          .single();
        
        if (fetchError) throw fetchError;
        
        const clockIn = new Date(updates.clock_in || entry.clock_in);
        const clockOut = updates.clock_out 
          ? new Date(updates.clock_out) 
          : entry.clock_out 
            ? new Date(entry.clock_out) 
            : null;
        
        if (clockOut) {
          (updates as Record<string, unknown>).duration_minutes = Math.floor(
            (clockOut.getTime() - clockIn.getTime()) / 60000
          );
        }
      }
      
      const { data, error } = await supabase
        .from("time_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}

// Delete time entry
export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    },
  });
}
