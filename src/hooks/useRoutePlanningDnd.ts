import { useState, useCallback } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface UseRoutePlanningDndOptions {
  selectedDate: Date;
  teamMembers: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>;
}

export function useRoutePlanningDnd({ selectedDate, teamMembers }: UseRoutePlanningDndOptions) {
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    console.log("useRoutePlanningDnd: Drag started", {
      activeId: active.id,
      type: active.data.current?.type,
      job: active.data.current?.job?.title,
    });
    if (active.data.current?.type === "job") {
      setActiveJob(active.data.current.job as Job);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);

    console.log("useRoutePlanningDnd: Drag ended", {
      activeId: active.id,
      overId: over?.id,
      overType: over?.data.current?.type,
      overWorkerId: over?.data.current?.workerId,
    });

    if (!over) {
      console.log("useRoutePlanningDnd: No drop target");
      return;
    }

    const job = active.data.current?.job as Job | undefined;
    const targetWorkerId = over.data.current?.workerId as string | undefined;

    if (!job || !targetWorkerId) return;

    // Don't re-assign if already assigned to the same worker
    if (job.assigned_to === targetWorkerId) {
      return;
    }

    setIsProcessing(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Get business_id from the job
      const businessId = job.business_id;

      // 1. Update job assignment
      const { error: jobError } = await supabase
        .from("jobs")
        .update({ 
          assigned_to: targetWorkerId,
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      if (jobError) throw jobError;

      // 2. Update job_assignments table
      // First remove existing assignment if any
      await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", job.id);

      // Add new assignment
      const { error: assignmentError } = await supabase
        .from("job_assignments")
        .insert({
          job_id: job.id,
          user_id: targetWorkerId,
          business_id: businessId,
        });

      if (assignmentError) throw assignmentError;

      // 3. Update or create daily_route_plan for target worker
      const { data: existingPlan } = await supabase
        .from("daily_route_plans")
        .select("*")
        .eq("user_id", targetWorkerId)
        .eq("route_date", dateStr)
        .maybeSingle();

      if (existingPlan) {
        // Add job to existing plan
        const updatedJobIds = [...(existingPlan.job_ids || []), job.id];
        await supabase
          .from("daily_route_plans")
          .update({ 
            job_ids: updatedJobIds,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingPlan.id);
      } else {
        // Create new plan for this worker
        await supabase
          .from("daily_route_plans")
          .insert({
            user_id: targetWorkerId,
            business_id: businessId,
            route_date: dateStr,
            job_ids: [job.id],
            status: "draft",
          });
      }

      // 4. If job was previously assigned, remove from old worker's route plan
      if (job.assigned_to && job.assigned_to !== targetWorkerId) {
        const { data: oldPlan } = await supabase
          .from("daily_route_plans")
          .select("*")
          .eq("user_id", job.assigned_to)
          .eq("route_date", dateStr)
          .maybeSingle();

        if (oldPlan) {
          const updatedJobIds = (oldPlan.job_ids || []).filter(
            (id: string) => id !== job.id
          );
          await supabase
            .from("daily_route_plans")
            .update({ 
              job_ids: updatedJobIds,
              updated_at: new Date().toISOString()
            })
            .eq("id", oldPlan.id);
        }
      }

      // Find worker name for toast
      const worker = teamMembers.find((m) => m.id === targetWorkerId);
      const workerName = worker
        ? `${worker.first_name || ""} ${worker.last_name || ""}`.trim() || "Worker"
        : "Worker";

      toast({
        title: "Job assigned",
        description: `${job.title} assigned to ${workerName}`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["job-assignments"] });

    } catch (error) {
      console.error("Failed to assign job:", error);
      toast({
        title: "Assignment failed",
        description: "Could not assign the job. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedDate, teamMembers, queryClient, toast]);

  const handleDragCancel = useCallback(() => {
    setActiveJob(null);
  }, []);

  return {
    activeJob,
    isProcessing,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
}
