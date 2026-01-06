import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "./useBusiness";
import { useOvertimeSettings } from "./useOvertimeSettings";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

export interface LaborCostBreakdown {
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  regularCost: number;
  overtimeCost: number;
  doubletimeCost: number;
  totalCost: number;
  billableAmount: number;
}

export interface DailyHours {
  date: Date;
  hours: number;
  overtimeHours: number;
  doubletimeHours: number;
}

// Calculate labor costs for a set of time entries
export function useLaborCostForEntries(
  entries: Array<{
    duration_minutes: number | null;
    labor_cost: number | null;
    bill_amount: number | null;
    is_billable: boolean | null;
  }> | undefined
) {
  return {
    regularHours: entries?.reduce((sum, e) => sum + (e.duration_minutes || 0) / 60, 0) || 0,
    totalCost: entries?.reduce((sum, e) => sum + (e.labor_cost || 0), 0) || 0,
    billableAmount: entries?.reduce((sum, e) => 
      sum + (e.is_billable ? (e.bill_amount || 0) : 0), 0
    ) || 0,
  };
}

// Get labor costs for a job
export function useJobLaborCosts(jobId: string | undefined) {
  return useQuery({
    queryKey: ["labor-costs", "job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .select("total_labor_minutes, total_labor_cost, total_billable_amount, estimated_duration_minutes")
        .eq("id", jobId)
        .single();
      
      if (jobError) throw jobError;
      
      const { data: entries, error: entriesError } = await supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          duration_minutes,
          labor_cost,
          bill_amount,
          is_billable,
          clock_in,
          clock_out,
          entry_type,
          user:profiles!time_entries_user_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq("job_id", jobId);
      
      if (entriesError) throw entriesError;
      
      // Group by user with user info
      const byUser: Record<string, { 
        minutes: number; 
        cost: number;
        user: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
        } | null;
      }> = {};
      
      entries?.forEach(entry => {
        if (!byUser[entry.user_id]) {
          byUser[entry.user_id] = { 
            minutes: 0, 
            cost: 0,
            user: entry.user as {
              id: string;
              first_name: string | null;
              last_name: string | null;
              avatar_url: string | null;
            } | null
          };
        }
        byUser[entry.user_id].minutes += entry.duration_minutes || 0;
        byUser[entry.user_id].cost += entry.labor_cost || 0;
      });
      
      return {
        totalMinutes: job.total_labor_minutes || 0,
        totalCost: job.total_labor_cost || 0,
        billableAmount: job.total_billable_amount || 0,
        estimatedMinutes: job.estimated_duration_minutes || 0,
        variance: job.estimated_duration_minutes 
          ? (job.total_labor_minutes || 0) - job.estimated_duration_minutes
          : null,
        byUser,
        entryCount: entries?.length || 0,
      };
    },
    enabled: !!jobId,
  });
}

// Get labor costs for an employee in a date range
export function useEmployeeLaborCosts(
  userId: string | undefined,
  startDate: Date,
  endDate: Date
) {
  const { settings: overtimeSettings } = useOvertimeSettings();
  
  return useQuery({
    queryKey: ["labor-costs", "employee", userId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString())
        .order("clock_in", { ascending: true });
      
      if (error) throw error;
      
      // Get pay rate
      const { data: payRate } = await supabase
        .from("employee_pay_rates")
        .select("*")
        .eq("user_id", userId)
        .lte("effective_from", format(endDate, "yyyy-MM-dd"))
        .or(`effective_to.is.null,effective_to.gte.${format(startDate, "yyyy-MM-dd")}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const regularRate = payRate?.hourly_rate || 0;
      const overtimeRate = payRate?.overtime_rate || regularRate * 1.5;
      const doubletimeRate = payRate?.double_time_rate || regularRate * 2;
      
      // Calculate daily hours
      const dailyHours: Record<string, number> = {};
      entries?.forEach(entry => {
        if (entry.clock_in) {
          const dateKey = format(new Date(entry.clock_in), "yyyy-MM-dd");
          dailyHours[dateKey] = (dailyHours[dateKey] || 0) + (entry.duration_minutes || 0) / 60;
        }
      });
      
      // Calculate overtime based on settings
      const dailyOvertimeThreshold = overtimeSettings?.daily_threshold_hours || 8;
      const weeklyOvertimeThreshold = overtimeSettings?.weekly_threshold_hours || 40;
      
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let totalDoubletimeHours = 0;
      
      // Simple daily overtime calculation
      Object.values(dailyHours).forEach(hours => {
        if (hours > dailyOvertimeThreshold) {
          totalRegularHours += dailyOvertimeThreshold;
          totalOvertimeHours += hours - dailyOvertimeThreshold;
        } else {
          totalRegularHours += hours;
        }
      });
      
      // Adjust for weekly overtime
      const totalHours = Object.values(dailyHours).reduce((sum, h) => sum + h, 0);
      if (totalHours > weeklyOvertimeThreshold && totalOvertimeHours < totalHours - weeklyOvertimeThreshold) {
        const additionalOT = (totalHours - weeklyOvertimeThreshold) - totalOvertimeHours;
        if (additionalOT > 0) {
          totalRegularHours -= additionalOT;
          totalOvertimeHours += additionalOT;
        }
      }
      
      const regularCost = totalRegularHours * regularRate;
      const overtimeCost = totalOvertimeHours * overtimeRate;
      const doubletimeCost = totalDoubletimeHours * doubletimeRate;
      
      return {
        regularHours: totalRegularHours,
        overtimeHours: totalOvertimeHours,
        doubletimeHours: totalDoubletimeHours,
        regularCost,
        overtimeCost,
        doubletimeCost,
        totalCost: regularCost + overtimeCost + doubletimeCost,
        entryCount: entries?.length || 0,
        dailyHours,
        payRate,
      };
    },
    enabled: !!userId,
  });
}

// Get business-wide labor costs for a date range
export function useBusinessLaborCosts(startDate: Date, endDate: Date) {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["labor-costs", "business", business?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!business?.id) return null;
      
      const { data: entries, error } = await supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          duration_minutes,
          labor_cost,
          bill_amount,
          is_billable,
          clock_in
        `)
        .eq("business_id", business.id)
        .gte("clock_in", startDate.toISOString())
        .lte("clock_in", endDate.toISOString());
      
      if (error) throw error;
      
      const totalMinutes = entries?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) || 0;
      const totalCost = entries?.reduce((sum, e) => sum + (e.labor_cost || 0), 0) || 0;
      const totalBillable = entries?.reduce((sum, e) => 
        sum + (e.is_billable ? (e.bill_amount || 0) : 0), 0
      ) || 0;
      
      // Group by user
      const byUser: Record<string, { minutes: number; cost: number }> = {};
      entries?.forEach(entry => {
        if (!byUser[entry.user_id]) {
          byUser[entry.user_id] = { minutes: 0, cost: 0 };
        }
        byUser[entry.user_id].minutes += entry.duration_minutes || 0;
        byUser[entry.user_id].cost += entry.labor_cost || 0;
      });
      
      return {
        totalHours: totalMinutes / 60,
        totalCost,
        totalBillable,
        profitMargin: totalBillable > 0 ? ((totalBillable - totalCost) / totalBillable) * 100 : 0,
        byUser,
        entryCount: entries?.length || 0,
      };
    },
    enabled: !!business?.id,
  });
}
