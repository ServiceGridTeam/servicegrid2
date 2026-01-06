import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "./useBusiness";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type TimesheetApproval = Tables<"timesheet_approvals">;

export interface TimesheetApprovalWithDetails extends TimesheetApproval {
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
  pay_period: {
    id: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
  reviewer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// Get all approvals for a pay period
export function useTimesheetApprovalsForPeriod(payPeriodId: string | undefined) {
  return useQuery({
    queryKey: ["timesheet-approvals", "period", payPeriodId],
    queryFn: async () => {
      if (!payPeriodId) return [];
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .select(`
          *,
          user:profiles!timesheet_approvals_user_id_fkey(id, first_name, last_name, avatar_url, email),
          pay_period:pay_periods(id, start_date, end_date, status),
          reviewer:profiles!timesheet_approvals_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq("pay_period_id", payPeriodId)
        .order("submitted_at", { ascending: false });
      
      if (error) throw error;
      return data as TimesheetApprovalWithDetails[];
    },
    enabled: !!payPeriodId,
  });
}

// Get pending approvals for the business
export function usePendingTimesheetApprovals() {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["timesheet-approvals", "pending", business?.id],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .select(`
          *,
          user:profiles!timesheet_approvals_user_id_fkey(id, first_name, last_name, avatar_url, email),
          pay_period:pay_periods(id, start_date, end_date, status),
          reviewer:profiles!timesheet_approvals_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq("business_id", business.id)
        .eq("status", "submitted")
        .order("submitted_at", { ascending: true });
      
      if (error) throw error;
      return data as TimesheetApprovalWithDetails[];
    },
    enabled: !!business?.id,
  });
}

// Get current user's timesheet approval for a period
export function useMyTimesheetApproval(payPeriodId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["timesheet-approvals", "my", payPeriodId, user?.id],
    queryFn: async () => {
      if (!payPeriodId || !user?.id) return null;
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .select(`
          *,
          pay_period:pay_periods(id, start_date, end_date, status),
          reviewer:profiles!timesheet_approvals_reviewed_by_fkey(id, first_name, last_name)
        `)
        .eq("pay_period_id", payPeriodId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!payPeriodId && !!user?.id,
  });
}

// Submit timesheet for approval
export function useSubmitTimesheet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      payPeriodId: string;
      notes?: string;
      regularMinutes: number;
      overtimeMinutes: number;
      doubletimeMinutes?: number;
      totalEntries: number;
      totalLaborCost: number;
      hasAnomalies?: boolean;
      anomalyCount?: number;
    }) => {
      if (!user?.id || !business?.id) throw new Error("Not authenticated");
      
      // Check if approval already exists
      const { data: existing } = await supabase
        .from("timesheet_approvals")
        .select("id, status")
        .eq("pay_period_id", params.payPeriodId)
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existing) {
        // Update existing approval
        const { data, error } = await supabase
          .from("timesheet_approvals")
          .update({
            status: "submitted",
            submitted_at: new Date().toISOString(),
            submitted_notes: params.notes,
            regular_hours: params.regularMinutes / 60,
            overtime_hours: params.overtimeMinutes / 60,
            double_time_hours: (params.doubletimeMinutes || 0) / 60,
            total_hours: (params.regularMinutes + params.overtimeMinutes + (params.doubletimeMinutes || 0)) / 60,
            total_labor_cost: params.totalLaborCost,
            has_anomalies: params.hasAnomalies || false,
            anomaly_details: [],
          })
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Create new approval
        const { data, error } = await supabase
          .from("timesheet_approvals")
          .insert({
            business_id: business.id,
            pay_period_id: params.payPeriodId,
            user_id: user.id,
            status: "submitted",
            submitted_at: new Date().toISOString(),
            submitted_notes: params.notes,
            regular_hours: params.regularMinutes / 60,
            overtime_hours: params.overtimeMinutes / 60,
            double_time_hours: (params.doubletimeMinutes || 0) / 60,
            total_hours: (params.regularMinutes + params.overtimeMinutes + (params.doubletimeMinutes || 0)) / 60,
            total_labor_cost: params.totalLaborCost,
            has_anomalies: params.hasAnomalies || false,
            anomaly_details: [],
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      
      // Trigger notification to managers
      if (business?.id && user?.id && data) {
        try {
          await supabase.functions.invoke("notify-timesheet-event", {
            body: {
              eventType: "submitted",
              timesheetApprovalId: data.id,
              businessId: business.id,
              userId: user.id,
              payPeriodId: data.pay_period_id,
            },
          });
        } catch (error) {
          console.error("Failed to send timesheet notification:", error);
        }
      }
    },
  });
}

// Approve a timesheet
export function useApproveTimesheet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      approvalId: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: params.notes,
        })
        .eq("id", params.approvalId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      toast.success("Timesheet approved");
      
      // Trigger notification to worker
      if (business?.id && user?.id && data) {
        try {
          await supabase.functions.invoke("notify-timesheet-event", {
            body: {
              eventType: "approved",
              timesheetApprovalId: data.id,
              businessId: business.id,
              userId: data.user_id,
              payPeriodId: data.pay_period_id,
              reviewerId: user.id,
            },
          });
        } catch (error) {
          console.error("Failed to send approval notification:", error);
        }
      }
    },
  });
}

// Reject a timesheet
export function useRejectTimesheet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      approvalId: string;
      rejectionReason: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: params.rejectionReason,
        })
        .eq("id", params.approvalId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-approvals"] });
      toast.success("Timesheet rejected");
      
      // Trigger notification to worker
      if (business?.id && user?.id && data) {
        try {
          await supabase.functions.invoke("notify-timesheet-event", {
            body: {
              eventType: "rejected",
              timesheetApprovalId: data.id,
              businessId: business.id,
              userId: data.user_id,
              payPeriodId: data.pay_period_id,
              reviewerId: user.id,
              rejectionReason: variables.rejectionReason,
            },
          });
        } catch (error) {
          console.error("Failed to send rejection notification:", error);
        }
      }
    },
  });
}

// Get approval stats for a pay period
export function useTimesheetApprovalStats(payPeriodId: string | undefined) {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["timesheet-approvals", "stats", payPeriodId],
    queryFn: async () => {
      if (!payPeriodId || !business?.id) return null;
      
      const { data, error } = await supabase
        .from("timesheet_approvals")
        .select("status")
        .eq("pay_period_id", payPeriodId)
        .eq("business_id", business.id);
      
      if (error) throw error;
      
      const stats = {
        draft: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        revised: 0,
        total: data.length,
      };
      
      data.forEach((approval) => {
        const status = approval.status as keyof typeof stats;
        if (status in stats) {
          stats[status]++;
        }
      });
      
      return stats;
    },
    enabled: !!payPeriodId && !!business?.id,
  });
}
