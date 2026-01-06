import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";
import { useEffect } from "react";

export type JobRequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted';
export type JobRequestUrgency = 'routine' | 'soon' | 'urgent' | 'emergency';
export type JobRequestSource = 'phone' | 'web' | 'walk-in';

export interface JobRequestAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface JobRequest {
  id: string;
  business_id: string;
  customer_id: string | null;
  source: JobRequestSource;
  source_metadata: Record<string, unknown>;
  form_data: Record<string, unknown>;
  service_type: string | null;
  description: string | null;
  address: JobRequestAddress | null;
  urgency: JobRequestUrgency;
  preferred_date: string | null;
  preferred_time: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: JobRequestStatus;
  priority_score: number;
  converted_to_job_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface JobRequestFilters {
  status?: JobRequestStatus | JobRequestStatus[];
  source?: JobRequestSource;
  urgency?: JobRequestUrgency;
  search?: string;
}

/**
 * Fetch job requests with optional filters
 */
export function useJobRequests(filters?: JobRequestFilters) {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["job-requests", profile?.business_id, filters],
    queryFn: async () => {
      if (!profile?.business_id) return [];

      let query = supabase
        .from("job_requests")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone)
        `)
        .eq("business_id", profile.business_id)
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters?.source) {
        query = query.eq("source", filters.source);
      }

      if (filters?.urgency) {
        query = query.eq("urgency", filters.urgency);
      }

      if (filters?.search) {
        query = query.or(
          `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as JobRequest[];
    },
    enabled: !!profile?.business_id,
  });
}

/**
 * Fetch a single job request by ID
 */
export function useJobRequest(id: string | undefined) {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["job-request", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("job_requests")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, address_line1, city, state, zip)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as JobRequest;
    },
    enabled: !!id && !!profile?.business_id,
  });
}

/**
 * Get count of pending job requests for badges
 */
export function usePendingRequestsCount() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["job-requests-count", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return 0;

      const { count, error } = await supabase
        .from("job_requests")
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
 * Subscribe to realtime updates for job requests
 */
export function useJobRequestsRealtime(onUpdate?: () => void) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!profile?.business_id) return;

    const channel = supabase
      .channel("job-requests-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "job_requests",
          filter: `business_id=eq.${profile.business_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["job-requests"] });
          queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.business_id, queryClient, onUpdate]);
}

/**
 * Approve a job request
 */
export function useApproveJobRequest() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      requestId,
      convertToJob = false,
    }: {
      requestId: string;
      convertToJob?: boolean;
    }) => {
      if (!profile?.id) throw new Error("No user found");

      const { error } = await supabase
        .from("job_requests")
        .update({
          status: convertToJob ? "converted" : "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;

      // TODO: If convertToJob, create the job and link it
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
      toast.success("Request approved");
    },
    onError: (error) => {
      console.error("Failed to approve request:", error);
      toast.error("Failed to approve request");
    },
  });
}

/**
 * Reject a job request
 */
export function useRejectJobRequest() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => {
      if (!profile?.id) throw new Error("No user found");

      const { error } = await supabase
        .from("job_requests")
        .update({
          status: "rejected",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
      toast.success("Request rejected");
    },
    onError: (error) => {
      console.error("Failed to reject request:", error);
      toast.error("Failed to reject request");
    },
  });
}

/**
 * Update a job request
 */
export function useUpdateJobRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      updates,
    }: {
      requestId: string;
      updates: {
        service_type?: string;
        description?: string;
        urgency?: JobRequestUrgency;
        preferred_date?: string;
        preferred_time?: string;
        customer_name?: string;
        customer_phone?: string;
        customer_email?: string;
        status?: JobRequestStatus;
        priority_score?: number;
      };
    }) => {
      const { error } = await supabase
        .from("job_requests")
        .update(updates)
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-request"] });
      toast.success("Request updated");
    },
    onError: (error) => {
      console.error("Failed to update request:", error);
      toast.error("Failed to update request");
    },
  });
}
