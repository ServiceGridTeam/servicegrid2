import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BulkAssignInput {
  jobIds: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  balanceWorkload?: boolean;
  constraints?: {
    maxJobsPerWorker?: number;
    preferredWorkerIds?: string[];
  };
}

export interface JobAssignment {
  jobId: string;
  userId: string;
  userName: string;
  scheduledStart: string;
  scheduledEnd: string;
  routePosition: number;
  reasoning: string;
}

export interface UnassignedJob {
  jobId: string;
  jobNumber: string;
  reason: string;
}

export interface BulkAssignResult {
  success: boolean;
  assignments: JobAssignment[];
  unassignedJobs: UnassignedJob[];
  routePlansCreated: string[];
  summary: {
    totalJobs: number;
    assigned: number;
    unassigned: number;
    workersUsed: number;
  };
  error?: string;
}

export function useBulkAutoAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkAssignInput): Promise<BulkAssignResult> => {
      const { data, error } = await supabase.functions.invoke("bulk-auto-assign", {
        body: input,
      });

      if (error) {
        throw new Error(error.message || "Failed to bulk assign jobs");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as BulkAssignResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["job-assignments"] });
    },
  });
}
