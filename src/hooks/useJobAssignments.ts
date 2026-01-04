import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type JobAssignment = Tables<"job_assignments">;
export type JobAssignmentWithUser = JobAssignment & {
  user: Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "email" | "avatar_url">;
};

export function useJobAssignments(jobId: string | undefined) {
  return useQuery({
    queryKey: ["job-assignments", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("job_assignments")
        .select(`
          *,
          user:profiles(id, first_name, last_name, email, avatar_url)
        `)
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as JobAssignmentWithUser[];
    },
    enabled: !!jobId,
  });
}

export function useUpdateJobAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      userIds, 
      businessId 
    }: { 
      jobId: string; 
      userIds: string[]; 
      businessId: string;
    }) => {
      // Delete existing assignments
      await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId);

      // Insert new assignments
      if (userIds.length > 0) {
        const assignments = userIds.map((userId, index) => ({
          job_id: jobId,
          user_id: userId,
          business_id: businessId,
          role: index === 0 ? "lead" : "assigned",
        }));

        const { error } = await supabase
          .from("job_assignments")
          .insert(assignments);

        if (error) throw error;
      }

      // Update the primary assigned_to field (first user = lead)
      const leadUserId = userIds.length > 0 ? userIds[0] : null;
      const { error: updateError } = await supabase
        .from("jobs")
        .update({ assigned_to: leadUserId })
        .eq("id", jobId);

      if (updateError) throw updateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-assignments", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useAddJobAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      userId, 
      businessId,
      role = "assigned",
    }: { 
      jobId: string; 
      userId: string; 
      businessId: string;
      role?: string;
    }) => {
      const { data, error } = await supabase
        .from("job_assignments")
        .insert({
          job_id: jobId,
          user_id: userId,
          business_id: businessId,
          role,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-assignments", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useRemoveJobAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      const { error } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job-assignments", variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}
