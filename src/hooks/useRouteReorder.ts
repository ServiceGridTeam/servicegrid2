import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseRouteReorderOptions {
  routePlanId: string;
  triggerOptimization?: boolean;
}

export function useRouteReorder({ routePlanId, triggerOptimization = true }: UseRouteReorderOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const reorderMutation = useMutation({
    mutationFn: async (newJobIds: string[]) => {
      // Update the route plan with new job order
      const { data, error } = await supabase
        .from("daily_route_plans")
        .update({
          job_ids: newJobIds,
          // Clear cached route data since order changed
          optimized_sequence: null,
          legs: null,
          overview_polyline: null,
          total_distance_meters: null,
          total_duration_seconds: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", routePlanId)
        .select()
        .single();

      if (error) throw error;

      // Update route_sequence on individual jobs
      const jobUpdates = newJobIds.map((jobId, index) =>
        supabase
          .from("jobs")
          .update({ route_sequence: index + 1 })
          .eq("id", jobId)
      );

      await Promise.all(jobUpdates);

      return data;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      toast({
        title: "Route updated",
        description: "Job order has been changed. Route will re-optimize automatically.",
      });

      // Trigger route optimization if enabled
      if (triggerOptimization) {
        optimizeRoute();
      }
    },
    onError: (error) => {
      console.error("Failed to reorder route:", error);
      toast({
        title: "Reorder failed",
        description: "Could not update the route order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      // Fetch the route plan to get user_id and date
      const { data: plan } = await supabase
        .from("daily_route_plans")
        .select("user_id, route_date")
        .eq("id", routePlanId)
        .single();

      if (!plan) throw new Error("Route plan not found");

      const { data, error } = await supabase.functions.invoke("optimize-job-route", {
        body: {
          userId: plan.user_id,
          date: plan.route_date,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (error) => {
      console.error("Route optimization failed:", error);
      // Don't show error toast for optimization - it's a background task
    },
  });

  const optimizeRoute = useCallback(() => {
    optimizeMutation.mutate();
  }, [optimizeMutation]);

  const reorderJobs = useCallback(
    async (newJobIds: string[]) => {
      await reorderMutation.mutateAsync(newJobIds);
    },
    [reorderMutation]
  );

  return {
    reorderJobs,
    optimizeRoute,
    isReordering: reorderMutation.isPending,
    isOptimizing: optimizeMutation.isPending,
  };
}
