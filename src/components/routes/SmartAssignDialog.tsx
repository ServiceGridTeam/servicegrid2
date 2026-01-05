import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  Navigation,
  CheckCircle2,
  Star
} from "lucide-react";
import { useAutoAssign } from "@/hooks/useAutoAssign";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import type { WorkerRoute } from "./MultiWorkerRouteMap";

type Job = Tables<"jobs">;

interface TeamMemberBase {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  max_daily_jobs?: number | null;
}

interface SmartAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  teamMembers: TeamMemberBase[];
  workerRoutes: WorkerRoute[];
  selectedDate: Date;
}

export function SmartAssignDialog({
  open,
  onOpenChange,
  job,
  teamMembers,
  workerRoutes,
  selectedDate,
}: SmartAssignDialogProps) {
  const autoAssign = useAutoAssign();
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);

  // Calculate fit scores for each worker
  const rankedWorkers = useMemo(() => {
    if (!job || !teamMembers.length) return [];

    return teamMembers.map((member) => {
      const route = workerRoutes.find((wr) => wr.userId === member.id);
      const currentJobCount = route?.jobs.length || 0;
      const maxJobs = member.max_daily_jobs || 8;
      const capacityRemaining = maxJobs - currentJobCount;

      // Calculate a simple fit score (0-100)
      let score = 100;

      // Penalize if at or over capacity
      if (capacityRemaining <= 0) {
        score -= 50;
      } else if (capacityRemaining === 1) {
        score -= 20;
      }

      // Boost if they have few jobs (balance workload)
      if (currentJobCount === 0) {
        score += 10;
      } else if (currentJobCount <= 2) {
        score += 5;
      }

      // Consider geographic proximity if we have coordinates
      let distance: number | null = null;
      if (job.latitude && job.longitude && route?.jobs.length) {
        const lastJob = route.jobs[route.jobs.length - 1];
        if (lastJob.latitude && lastJob.longitude) {
          // Simple euclidean distance (not actual driving distance)
          const latDiff = job.latitude - lastJob.latitude;
          const lngDiff = job.longitude - lastJob.longitude;
          distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69; // ~miles
          
          // Adjust score based on distance
          if (distance < 5) score += 15;
          else if (distance < 15) score += 5;
          else if (distance > 30) score -= 15;
        }
      }

      return {
        member,
        route,
        currentJobCount,
        maxJobs,
        capacityRemaining,
        distance,
        score: Math.max(0, Math.min(100, score)),
        isRecommended: false,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((w, idx) => ({ ...w, isRecommended: idx === 0 }));
  }, [job, teamMembers, workerRoutes]);

  const handleAssign = async (workerId: string) => {
    if (!job) return;

    setSelectedWorker(workerId);
    try {
      await autoAssign.mutateAsync({
        jobId: job.id,
        preferredDate: format(selectedDate, "yyyy-MM-dd"),
        preferredWorkerId: workerId,
      });
      toast({ title: "Job assigned", description: "The job has been assigned successfully." });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Could not assign job",
        variant: "destructive",
      });
    } finally {
      setSelectedWorker(null);
    }
  };

  const getInitials = (first?: string | null, last?: string | null) => {
    return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Assign
          </DialogTitle>
          <DialogDescription>
            {job ? (
              <>
                Choose the best team member for <strong>{job.title}</strong>
              </>
            ) : (
              "Select a job to assign"
            )}
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className="space-y-4">
            {/* Job summary */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <h4 className="font-medium text-sm">{job.title}</h4>
              {(job.address_line1 || job.city) && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[job.address_line1, job.city, job.state].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {job.estimated_duration_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {job.estimated_duration_minutes} min
                  </span>
                )}
                {job.scheduled_start && (
                  <span>{format(new Date(job.scheduled_start), "h:mm a")}</span>
                )}
              </div>
            </div>

            {/* Worker options */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rankedWorkers.map(({ member, currentJobCount, maxJobs, capacityRemaining, distance, score, isRecommended }) => (
                <button
                  key={member.id}
                  onClick={() => handleAssign(member.id)}
                  disabled={autoAssign.isPending}
                  className={`w-full p-3 rounded-lg border text-left transition-all hover:bg-muted/50 disabled:opacity-50 ${
                    isRecommended ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-muted">
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {member.first_name} {member.last_name}
                        </span>
                        {isRecommended && (
                          <Badge className="gap-1 bg-primary text-primary-foreground">
                            <Star className="h-3 w-3" />
                            Best Match
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{currentJobCount}/{maxJobs} jobs</span>
                        {distance !== null && (
                          <span className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {distance.toFixed(1)} mi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <Progress 
                          value={(currentJobCount / maxJobs) * 100} 
                          className="h-1.5 flex-1" 
                        />
                        <span className={`text-xs font-medium ${getScoreColor(score)}`}>
                          {score}%
                        </span>
                      </div>
                    </div>

                    {selectedWorker === member.id && autoAssign.isPending ? (
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-muted-foreground/30" />
                    )}
                  </div>
                </button>
              ))}

              {rankedWorkers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No team members available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
