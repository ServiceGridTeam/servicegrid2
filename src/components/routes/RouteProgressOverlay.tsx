import { useMemo } from "react";
import { Clock, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface RouteProgressOverlayProps {
  jobs: Job[];
  currentJobIndex: number;
  workerLocation?: { lat: number; lng: number } | null;
  nextEta?: string | null;
}

export function RouteProgressOverlay({
  jobs,
  currentJobIndex,
  workerLocation,
  nextEta,
}: RouteProgressOverlayProps) {
  const progressInfo = useMemo(() => {
    const completedCount = currentJobIndex;
    const totalCount = jobs.length;
    const remainingCount = totalCount - currentJobIndex;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const currentJob = jobs[currentJobIndex];
    const nextJob = jobs[currentJobIndex + 1];

    return {
      completedCount,
      totalCount,
      remainingCount,
      progressPercent,
      currentJob,
      nextJob,
    };
  }, [jobs, currentJobIndex]);

  const etaLabel = useMemo(() => {
    if (!nextEta) return null;
    try {
      const etaDate = new Date(nextEta);
      return formatDistanceToNow(etaDate, { addSuffix: true });
    } catch {
      return null;
    }
  }, [nextEta]);

  if (jobs.length === 0) return null;

  return (
    <div className="absolute top-4 left-4 z-20 bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg p-4 min-w-[200px]">
      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium">Route Progress</span>
          <span className="text-muted-foreground">
            {progressInfo.completedCount}/{progressInfo.totalCount}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progressInfo.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Current status */}
      {progressInfo.currentJob && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium">Current Stop</span>
          </div>
          <p className="text-sm text-muted-foreground pl-4">
            {progressInfo.currentJob.title || `Job #${progressInfo.currentJob.job_number}`}
          </p>
        </div>
      )}

      {/* Next stop ETA */}
      {progressInfo.nextJob && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Next Stop</span>
          </div>
          <p className="text-sm text-muted-foreground pl-6">
            {progressInfo.nextJob.title || `Job #${progressInfo.nextJob.job_number}`}
          </p>
          {etaLabel && (
            <div className="flex items-center gap-1 pl-6">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">ETA: {etaLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Remaining jobs */}
      {progressInfo.remainingCount > 1 && (
        <div className="mt-3 pt-3 border-t">
          <Badge variant="secondary" className="text-xs">
            {progressInfo.remainingCount - 1} more stop{progressInfo.remainingCount > 2 ? "s" : ""} after
          </Badge>
        </div>
      )}

      {/* Worker location indicator */}
      {workerLocation && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse border-2 border-white shadow" />
          <span>Live location</span>
        </div>
      )}
    </div>
  );
}
