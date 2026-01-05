import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutoAssignInput {
  jobId: string;
  preferredDate?: string;
  preferredWorkerId?: string;
}

export interface AutoAssignResult {
  success: boolean;
  assignment?: {
    userId: string;
    userName: string;
    scheduledStart: string;
    scheduledEnd: string;
    routePosition: number;
  };
  reasoning: string;
  alternatives: {
    userId: string;
    userName: string;
    fitScore: number;
    reason: string;
  }[];
  routePlanId?: string;
  error?: string;
}

export function useAutoAssign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AutoAssignInput): Promise<AutoAssignResult> => {
      const { data, error } = await supabase.functions.invoke("auto-assign-job", {
        body: input,
      });

      if (error) {
        throw new Error(error.message || "Failed to auto-assign job");
      }

      return data as AutoAssignResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
    },
  });
}
