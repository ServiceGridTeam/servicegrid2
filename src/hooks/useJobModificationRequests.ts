import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";

export type ModificationType = 'reschedule' | 'cancel';
export type ModificationStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type ModificationSource = 'phone' | 'web' | 'walk-in';

export interface JobModificationRequest {
  id: string;
  job_id: string;
  business_id: string;
  modification_type: ModificationType;
  requested_date: string | null;
  time_preference: string | null;
  reason: string | null;
  source: ModificationSource;
  source_metadata: Record<string, unknown>;
  status: ModificationStatus;
  processed_by: string | null;
  processed_at: string | null;
  new_scheduled_start: string | null;
  new_scheduled_end: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  job?: {
    id: string;
    title: string;
    job_number: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    customer?: {
      id: string;
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

export interface ModificationRequestFilters {
  status?: ModificationStatus | ModificationStatus[];
  modification_type?: ModificationType;
  job_id?: string;
}

/**
 * Fetch job modification requests with optional filters
 */
export function useJobModificationRequests(filters?: ModificationRequestFilters) {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["job-modification-requests", profile?.business_id, filters],
    queryFn: async () => {
      if (!profile?.business_id) return [];

      let query = supabase
        .from("job_modification_requests")
        .select(`
          *,
          job:jobs(
            id,
            title,
            job_number,
            scheduled_start,
            scheduled_end,
            customer:customers(id, first_name, last_name)
          )
        `)
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters?.modification_type) {
        query = query.eq("modification_type", filters.modification_type);
      }

      if (filters?.job_id) {
        query = query.eq("job_id", filters.job_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as JobModificationRequest[];
    },
    enabled: !!profile?.business_id,
  });
}

/**
 * Get count of pending modification requests for badges
 */
export function usePendingModificationsCount() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["job-modification-requests-count", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return 0;

      const { count, error } = await supabase
        .from("job_modification_requests")
        .select("*", { count: "exact", head: true })
        .eq("business_id", profile.business_id)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!profile?.business_id,
  });
}

/**
 * Approve a modification request
 */
export function useApproveModification() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      requestId,
      newScheduledStart,
      newScheduledEnd,
    }: {
      requestId: string;
      newScheduledStart?: string;
      newScheduledEnd?: string;
    }) => {
      if (!profile?.id) throw new Error("No user found");

      // Get the modification request to check type
      const { data: request, error: fetchError } = await supabase
        .from("job_modification_requests")
        .select("job_id, modification_type")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;

      // Update the modification request
      const { error: updateError } = await supabase
        .from("job_modification_requests")
        .update({
          status: "approved",
          processed_by: profile.id,
          processed_at: new Date().toISOString(),
          new_scheduled_start: newScheduledStart,
          new_scheduled_end: newScheduledEnd,
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // Update the job based on modification type
      if (request.modification_type === "cancel") {
        await supabase
          .from("jobs")
          .update({ status: "cancelled" })
          .eq("id", request.job_id);
      } else if (request.modification_type === "reschedule" && newScheduledStart) {
        await supabase
          .from("jobs")
          .update({
            scheduled_start: newScheduledStart,
            scheduled_end: newScheduledEnd,
          })
          .eq("id", request.job_id);
      }

      // Mark as completed
      await supabase
        .from("job_modification_requests")
        .update({ status: "completed" })
        .eq("id", requestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-modification-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-modification-requests-count"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Modification approved");
    },
    onError: (error) => {
      console.error("Failed to approve modification:", error);
      toast.error("Failed to approve modification");
    },
  });
}

/**
 * Reject a modification request
 */
export function useRejectModification() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason?: string;
    }) => {
      if (!profile?.id) throw new Error("No user found");

      const { error } = await supabase
        .from("job_modification_requests")
        .update({
          status: "rejected",
          processed_by: profile.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-modification-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-modification-requests-count"] });
      toast.success("Modification rejected");
    },
    onError: (error) => {
      console.error("Failed to reject modification:", error);
      toast.error("Failed to reject modification");
    },
  });
}
