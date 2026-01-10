import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";
import { useEffect } from "react";

export type JobRequestStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'converted';
export type JobRequestUrgency = 'routine' | 'soon' | 'urgent' | 'emergency';
export type JobRequestSource = 'phone' | 'web' | 'walk-in' | 'email';

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

export interface ApproveJobRequestParams {
  requestId: string;
  convertToJob?: boolean;
  scheduleData?: {
    date: string;
    time: string;
    durationMinutes: number;
  };
  customerData?: {
    name: string;
    phone: string;
    email: string;
  };
  address?: JobRequestAddress | null;
  serviceType?: string;
  description?: string;
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
      scheduleData,
      customerData,
      address,
      serviceType,
      description,
    }: ApproveJobRequestParams) => {
      if (!profile?.id || !profile?.business_id) throw new Error("No user found");

      // If converting to job, create the job first
      let jobId: string | null = null;

      if (convertToJob && scheduleData) {
        // Generate job number
        const { count } = await supabase
          .from("jobs")
          .select("*", { count: "exact", head: true })
          .eq("business_id", profile.business_id);

        const jobNumber = `JOB-${String((count || 0) + 1).padStart(4, "0")}`;

        // Calculate scheduled times
        const scheduledStart = new Date(`${scheduleData.date}T${scheduleData.time}`);
        const scheduledEnd = new Date(scheduledStart.getTime() + scheduleData.durationMinutes * 60000);

        // Get the request to check for customer_id
        const { data: request } = await supabase
          .from("job_requests")
          .select("customer_id")
          .eq("id", requestId)
          .single();

        let customerId = request?.customer_id;

        // Create customer if needed
        if (!customerId && customerData?.name) {
          const nameParts = customerData.name.trim().split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const { data: newCustomer, error: customerError } = await supabase
            .from("customers")
            .insert({
              business_id: profile.business_id,
              first_name: firstName,
              last_name: lastName,
              phone: customerData.phone || null,
              email: customerData.email || null,
              address_line1: address?.line1 || null,
              city: address?.city || null,
              state: address?.state || null,
              zip: address?.zip || null,
            })
            .select("id")
            .single();

          if (customerError) throw customerError;
          customerId = newCustomer.id;
        }

        // Create the job
        const jobTitle = [serviceType, description].filter(Boolean).join(" - ") || "New Job";

        const { data: newJob, error: jobError } = await supabase
          .from("jobs")
          .insert({
            business_id: profile.business_id,
            customer_id: customerId,
            job_number: jobNumber,
            title: jobTitle.slice(0, 100),
            description: description || null,
            status: "scheduled",
            scheduled_start: scheduledStart.toISOString(),
            scheduled_end: scheduledEnd.toISOString(),
            address_line1: address?.line1 || null,
            city: address?.city || null,
            state: address?.state || null,
            zip: address?.zip || null,
          })
          .select("id")
          .single();

        if (jobError) throw jobError;
        jobId = newJob.id;
      }

      // Update the request
      const { error } = await supabase
        .from("job_requests")
        .update({
          status: convertToJob ? "converted" : "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          converted_to_job_id: jobId,
        })
        .eq("id", requestId);

      if (error) throw error;

      return { jobId };
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      
      if (variables.convertToJob && data?.jobId) {
        toast.success("Request converted to job");
        
        // Convert customer uploads to job media
        try {
          const { error } = await supabase.functions.invoke("convert-customer-uploads", {
            body: {
              job_request_id: variables.requestId,
              job_id: data.jobId,
            },
          });
          if (error) {
            console.warn("Failed to convert customer uploads:", error);
          }
        } catch (err) {
          console.warn("Error converting customer uploads:", err);
        }
      } else {
        toast.success("Request approved");
      }
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

/**
 * Bulk approve multiple job requests
 */
export function useBulkApproveRequests() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (requestIds: string[]) => {
      if (!profile?.id) throw new Error("No user found");

      const { error } = await supabase
        .from("job_requests")
        .update({
          status: "approved",
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", requestIds);

      if (error) throw error;
    },
    onSuccess: (_, requestIds) => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
      toast.success(`${requestIds.length} requests approved`);
    },
    onError: (error) => {
      console.error("Failed to bulk approve requests:", error);
      toast.error("Failed to approve requests");
    },
  });
}

/**
 * Bulk reject multiple job requests
 */
export function useBulkRejectRequests() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async ({
      requestIds,
      reason,
    }: {
      requestIds: string[];
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
        .in("id", requestIds);

      if (error) throw error;
    },
    onSuccess: (_, { requestIds }) => {
      queryClient.invalidateQueries({ queryKey: ["job-requests"] });
      queryClient.invalidateQueries({ queryKey: ["job-requests-count"] });
      toast.success(`${requestIds.length} requests rejected`);
    },
    onError: (error) => {
      console.error("Failed to bulk reject requests:", error);
      toast.error("Failed to reject requests");
    },
  });
}
