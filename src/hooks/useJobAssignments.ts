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
      // Get existing assignments to determine new assignees
      const { data: existingAssignments } = await supabase
        .from("job_assignments")
        .select("user_id")
        .eq("job_id", jobId);

      const existingUserIds = new Set(existingAssignments?.map(a => a.user_id) || []);
      const newUserIds = userIds.filter(id => !existingUserIds.has(id));

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

      return { newUserIds, businessId, jobId };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-assignments", result.jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      // Notify newly assigned users
      if (result.newUserIds.length > 0) {
        try {
          await supabase.functions.invoke("notify-job-assigned", {
            body: {
              jobId: result.jobId,
              assignedUserIds: result.newUserIds,
              businessId: result.businessId,
            },
          });
        } catch (err) {
          console.error("Failed to send job assignment notifications:", err);
        }
      }
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
      return { ...data, businessId };
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ["job-assignments", result.job_id] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      // Notify the assigned user
      try {
        await supabase.functions.invoke("notify-job-assigned", {
          body: {
            jobId: result.job_id,
            assignedUserIds: [result.user_id],
            businessId: result.businessId,
          },
        });
      } catch (err) {
        console.error("Failed to send job assignment notification:", err);
      }
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
