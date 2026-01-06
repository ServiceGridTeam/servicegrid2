import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { geocodeJobAddress } from "@/utils/geocodeJob";

export type Job = Tables<"jobs">;

type ProfileInfo = Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email" | "avatar_url">;

export type JobAssignmentInfo = {
  id: string;
  user_id: string;
  role: string | null;
  user: ProfileInfo;
};

export type JobWithCustomer = Job & {
  customer: Pick<Tables<"customers">, "id" | "first_name" | "last_name" | "email" | "phone" | "address_line1" | "city" | "state" | "zip"> | null;
  assignee: Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email"> | null;
  assignments?: JobAssignmentInfo[];
};

interface UseJobsOptions {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customerId?: string;
}

export function useJobs(options?: UseJobsOptions) {
  return useQuery({
    queryKey: ["jobs", options],
    queryFn: async () => {
      let query = supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, address_line1, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(id, first_name, last_name, email),
          assignments:job_assignments(id, user_id, role, user:profiles(id, first_name, last_name, email, avatar_url))
        `)
        .order("scheduled_start", { ascending: true, nullsFirst: false });

      if (options?.customerId) {
        query = query.eq("customer_id", options.customerId);
      }

      if (options?.search) {
        query = query.or(`title.ilike.%${options.search}%,job_number.ilike.%${options.search}%`);
      }

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      if (options?.dateFrom) {
        query = query.gte("scheduled_start", options.dateFrom.toISOString());
      }

      if (options?.dateTo) {
        query = query.lte("scheduled_start", options.dateTo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as JobWithCustomer[];
    },
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email, phone, address_line1, address_line2, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(id, first_name, last_name, email),
          assignments:job_assignments(id, user_id, role, user:profiles(id, first_name, last_name, email, avatar_url))
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as JobWithCustomer | null;
    },
    enabled: !!id,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profile?.business_id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, avatar_url")
        .eq("business_id", profile.business_id);

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: Omit<TablesInsert<"jobs">, "job_number" | "business_id">) => {
      // Get the business_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();

      if (!profile?.business_id) throw new Error("Business not found");

      // Get the next job number
      const { data: existingJobs } = await supabase
        .from("jobs")
        .select("job_number")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingJobs && existingJobs.length > 0) {
        const lastNumber = existingJobs[0].job_number;
        const match = lastNumber.match(/JOB-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const jobNumber = `JOB-${String(nextNumber).padStart(4, "0")}`;

      const { data, error } = await supabase
        .from("jobs")
        .insert({
          ...job,
          business_id: profile.business_id,
          job_number: jobNumber,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-geocode the job address if address fields are provided
      if (job.address_line1 || job.city) {
        geocodeJobAddress(data.id, {
          address_line1: job.address_line1,
          city: job.city,
          state: job.state,
          zip: job.zip,
        }).catch((err) => console.error("Failed to geocode new job:", err));
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"jobs"> & { id: string }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Re-geocode if address fields were updated
      const addressUpdated = 
        "address_line1" in updates ||
        "city" in updates ||
        "state" in updates ||
        "zip" in updates;

      if (addressUpdated) {
        geocodeJobAddress(id, {
          address_line1: updates.address_line1 ?? data.address_line1,
          city: updates.city ?? data.city,
          state: updates.state ?? data.state,
          zip: updates.zip ?? data.zip,
        }).catch((err) => console.error("Failed to geocode updated job:", err));
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", data.id] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
