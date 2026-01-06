import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TimesheetAnomalies {
  geofenceViolations: number;
  manualEntries: number;
  editedEntries: number;
  hasOvertime: boolean;
  overtimeMinutes: number;
  violations: Array<{
    entryId: string;
    type: "geofence" | "manual" | "edited";
    details: string;
  }>;
}

export function useTimesheetAnomalies(
  startDate: Date,
  endDate: Date,
  userId?: string
) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ["timesheet-anomalies", targetUserId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TimesheetAnomalies> => {
      if (!targetUserId) {
        return {
          geofenceViolations: 0,
          manualEntries: 0,
          editedEntries: 0,
          hasOvertime: false,
          overtimeMinutes: 0,
          violations: [],
        };
      }

      // Get time entries for the period
      const { data: entries, error: entriesError } = await supabase
        .from("time_entries")
        .select("id, is_manual, edited_at, clock_in_event_id, clock_out_event_id, duration_minutes")
        .eq("user_id", targetUserId)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString());

      if (entriesError) throw entriesError;

      const violations: TimesheetAnomalies["violations"] = [];
      let manualEntries = 0;
      let editedEntries = 0;

      // Count manual and edited entries
      for (const entry of entries || []) {
        if (entry.is_manual) {
          manualEntries++;
          violations.push({
            entryId: entry.id,
            type: "manual",
            details: "Manual time entry",
          });
        }
        if (entry.edited_at) {
          editedEntries++;
          violations.push({
            entryId: entry.id,
            type: "edited",
            details: "Entry was edited",
          });
        }
      }

      // Get clock events with geofence violations
      const clockEventIds = (entries || [])
        .flatMap((e) => [e.clock_in_event_id, e.clock_out_event_id])
        .filter(Boolean);

      let geofenceViolations = 0;
      if (clockEventIds.length > 0) {
        const { data: clockEvents, error: clockError } = await supabase
          .from("clock_events")
          .select("id, within_geofence, distance_from_job_meters")
          .in("id", clockEventIds)
          .eq("within_geofence", false);

        if (clockError) throw clockError;

        geofenceViolations = clockEvents?.length || 0;
        for (const event of clockEvents || []) {
          violations.push({
            entryId: event.id,
            type: "geofence",
            details: `Clocked ${Math.round(event.distance_from_job_meters || 0)}m from job site`,
          });
        }
      }

      // Calculate total minutes for overtime check
      const totalMinutes = (entries || []).reduce(
        (sum, e) => sum + (e.duration_minutes || 0),
        0
      );
      const weeklyThresholdMinutes = 40 * 60; // Default 40 hours
      const overtimeMinutes = Math.max(0, totalMinutes - weeklyThresholdMinutes);

      return {
        geofenceViolations,
        manualEntries,
        editedEntries,
        hasOvertime: overtimeMinutes > 0,
        overtimeMinutes,
        violations,
      };
    },
    enabled: !!targetUserId,
  });
}
