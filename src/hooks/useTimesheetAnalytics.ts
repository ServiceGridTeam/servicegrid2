import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "./useBusiness";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, eachWeekOfInterval, eachMonthOfInterval, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";

export interface LaborCostTrendPoint {
  date: string;
  label: string;
  regularCost: number;
  overtimeCost: number;
  totalCost: number;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
}

export interface EmployeeOvertimeData {
  userId: string;
  userName: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  totalHours: number;
}

export interface ApprovalMetrics {
  totalSubmitted: number;
  totalApproved: number;
  totalRejected: number;
  totalPending: number;
  approvalRate: number;
  rejectionRate: number;
  avgApprovalTimeHours: number;
  pendingByAge: { label: string; count: number }[];
}

export interface DayOfWeekOvertimeData {
  dayOfWeek: string;
  regularHours: number;
  overtimeHours: number;
}

export function useLaborCostTrends(
  startDate: Date,
  endDate: Date,
  granularity: "daily" | "weekly" | "monthly" = "weekly"
) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ["labor-cost-trends", business?.id, startDate.toISOString(), endDate.toISOString(), granularity],
    queryFn: async (): Promise<LaborCostTrendPoint[]> => {
      if (!business?.id) return [];

      // Get time entries within date range
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("clock_in, clock_out, duration_minutes, labor_cost, bill_amount")
        .eq("business_id", business.id)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .not("clock_out", "is", null);

      if (error) throw error;

      // Generate date buckets based on granularity
      let intervals: Date[];
      if (granularity === "daily") {
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
      } else if (granularity === "weekly") {
        intervals = eachWeekOfInterval({ start: startDate, end: endDate });
      } else {
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
      }

      // Aggregate data by bucket
      const trendData: LaborCostTrendPoint[] = intervals.map((intervalStart) => {
        let intervalEnd: Date;
        let label: string;

        if (granularity === "daily") {
          intervalEnd = endOfDay(intervalStart);
          label = format(intervalStart, "MMM d");
        } else if (granularity === "weekly") {
          intervalEnd = endOfWeek(intervalStart);
          label = `Week of ${format(intervalStart, "MMM d")}`;
        } else {
          intervalEnd = endOfMonth(intervalStart);
          label = format(intervalStart, "MMM yyyy");
        }

        const bucketEntries = (entries || []).filter((entry) => {
          const entryDate = new Date(entry.clock_in);
          return entryDate >= intervalStart && entryDate <= intervalEnd;
        });

        const totalHours = bucketEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;
        const totalCost = bucketEntries.reduce((sum, e) => sum + Number(e.labor_cost || 0), 0);

        // Estimate regular vs overtime (assume 8h/day is regular, rest is OT)
        const regularHours = Math.min(totalHours, 40);
        const overtimeHours = Math.max(0, totalHours - 40);
        const regularCost = totalHours > 0 ? (regularHours / totalHours) * totalCost : 0;
        const overtimeCost = totalCost - regularCost;

        return {
          date: intervalStart.toISOString(),
          label,
          regularCost,
          overtimeCost,
          totalCost,
          regularHours,
          overtimeHours,
          totalHours,
        };
      });

      return trendData;
    },
    enabled: !!business?.id,
  });
}

export function useOvertimePatterns(startDate: Date, endDate: Date) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ["overtime-patterns", business?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<EmployeeOvertimeData[]> => {
      if (!business?.id) return [];

      // Get time entries grouped by user
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select(`
          user_id,
          duration_minutes,
          profiles:user_id(first_name, last_name, email)
        `)
        .eq("business_id", business.id)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .not("clock_out", "is", null);

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, EmployeeOvertimeData>();

      (entries || []).forEach((entry: any) => {
        const userId = entry.user_id;
        const existing = userMap.get(userId);
        const profile = entry.profiles;
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "Unknown"
          : "Unknown";

        const durationHours = (entry.duration_minutes || 0) / 60;

        if (existing) {
          existing.totalHours += durationHours;
          // Rough estimation: first 40h/week is regular, rest is overtime
          existing.regularHours = Math.min(existing.totalHours, 40);
          existing.overtimeHours = Math.max(0, existing.totalHours - 40);
        } else {
          userMap.set(userId, {
            userId,
            userName,
            regularHours: Math.min(durationHours, 40),
            overtimeHours: Math.max(0, durationHours - 40),
            doubletimeHours: 0,
            totalHours: durationHours,
          });
        }
      });

      return Array.from(userMap.values()).sort((a, b) => b.totalHours - a.totalHours);
    },
    enabled: !!business?.id,
  });
}

export function useDayOfWeekOvertimePatterns(startDate: Date, endDate: Date) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ["overtime-by-day", business?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<DayOfWeekOvertimeData[]> => {
      if (!business?.id) return [];

      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("clock_in, duration_minutes")
        .eq("business_id", business.id)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .not("clock_out", "is", null);

      if (error) throw error;

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayData = days.map((day) => ({ dayOfWeek: day, regularHours: 0, overtimeHours: 0 }));

      (entries || []).forEach((entry) => {
        const dayIndex = new Date(entry.clock_in).getDay();
        const hours = (entry.duration_minutes || 0) / 60;
        // Simplified: assume > 8h in a day is overtime
        const regularHours = Math.min(hours, 8);
        const overtimeHours = Math.max(0, hours - 8);
        dayData[dayIndex].regularHours += regularHours;
        dayData[dayIndex].overtimeHours += overtimeHours;
      });

      return dayData;
    },
    enabled: !!business?.id,
  });
}

export function useApprovalMetrics(startDate: Date, endDate: Date) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ["approval-metrics", business?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<ApprovalMetrics> => {
      if (!business?.id) {
        return {
          totalSubmitted: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalPending: 0,
          approvalRate: 0,
          rejectionRate: 0,
          avgApprovalTimeHours: 0,
          pendingByAge: [],
        };
      }

      const { data: approvals, error } = await supabase
        .from("timesheet_approvals")
        .select("status, submitted_at, reviewed_at, created_at")
        .eq("business_id", business.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const totalSubmitted = (approvals || []).filter((a) => a.status !== "draft").length;
      const totalApproved = (approvals || []).filter((a) => a.status === "approved").length;
      const totalRejected = (approvals || []).filter((a) => a.status === "rejected").length;
      const totalPending = (approvals || []).filter((a) => a.status === "submitted").length;

      const approvalRate = totalSubmitted > 0 ? (totalApproved / totalSubmitted) * 100 : 0;
      const rejectionRate = totalSubmitted > 0 ? (totalRejected / totalSubmitted) * 100 : 0;

      // Calculate average approval time
      const approvedWithTimes = (approvals || []).filter(
        (a) => a.status === "approved" && a.submitted_at && a.reviewed_at
      );
      const totalApprovalTimeMs = approvedWithTimes.reduce((sum, a) => {
        const submitted = new Date(a.submitted_at!).getTime();
        const reviewed = new Date(a.reviewed_at!).getTime();
        return sum + (reviewed - submitted);
      }, 0);
      const avgApprovalTimeHours = approvedWithTimes.length > 0
        ? totalApprovalTimeMs / approvedWithTimes.length / (1000 * 60 * 60)
        : 0;

      // Calculate pending by age
      const now = new Date();
      const pendingApprovals = (approvals || []).filter((a) => a.status === "submitted" && a.submitted_at);
      
      const pendingByAge = [
        { label: "< 24 hours", count: 0 },
        { label: "1-3 days", count: 0 },
        { label: "3-7 days", count: 0 },
        { label: "> 7 days", count: 0 },
      ];

      pendingApprovals.forEach((a) => {
        const ageHours = (now.getTime() - new Date(a.submitted_at!).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) pendingByAge[0].count++;
        else if (ageHours < 72) pendingByAge[1].count++;
        else if (ageHours < 168) pendingByAge[2].count++;
        else pendingByAge[3].count++;
      });

      return {
        totalSubmitted,
        totalApproved,
        totalRejected,
        totalPending,
        approvalRate,
        rejectionRate,
        avgApprovalTimeHours,
        pendingByAge,
      };
    },
    enabled: !!business?.id,
  });
}

export function useLaborSummary(startDate: Date, endDate: Date) {
  const { data: business } = useBusiness();

  return useQuery({
    queryKey: ["labor-summary", business?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!business?.id) return null;

      // Current period
      const { data: currentEntries } = await supabase
        .from("time_entries")
        .select("duration_minutes, labor_cost")
        .eq("business_id", business.id)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .not("clock_out", "is", null);

      // Previous period (same duration before start date)
      const duration = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - duration);
      const prevEndDate = new Date(startDate.getTime() - 1);

      const { data: previousEntries } = await supabase
        .from("time_entries")
        .select("duration_minutes, labor_cost")
        .eq("business_id", business.id)
        .gte("clock_in", prevStartDate.toISOString())
        .lte("clock_in", prevEndDate.toISOString())
        .not("clock_out", "is", null);

      const currentTotalHours = (currentEntries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;
      const previousTotalHours = (previousEntries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;

      const current = {
        totalCost: (currentEntries || []).reduce((sum, e) => sum + Number(e.labor_cost || 0), 0),
        totalHours: currentTotalHours,
        overtimeHours: Math.max(0, currentTotalHours - 40),
      };

      const previous = {
        totalCost: (previousEntries || []).reduce((sum, e) => sum + Number(e.labor_cost || 0), 0),
        totalHours: previousTotalHours,
        overtimeHours: Math.max(0, previousTotalHours - 40),
      };

      const costChange = previous.totalCost > 0 ? ((current.totalCost - previous.totalCost) / previous.totalCost) * 100 : 0;
      const hoursChange = previous.totalHours > 0 ? ((current.totalHours - previous.totalHours) / previous.totalHours) * 100 : 0;
      const overtimeChange = previous.overtimeHours > 0 ? ((current.overtimeHours - previous.overtimeHours) / previous.overtimeHours) * 100 : 0;

      return {
        current,
        previous,
        costChange,
        hoursChange,
        overtimeChange,
      };
    },
    enabled: !!business?.id,
  });
}
