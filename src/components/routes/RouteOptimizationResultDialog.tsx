import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, Route, Clock, Ruler } from "lucide-react";
import { formatDistance, formatDuration } from "@/hooks/useRouteOptimization";

interface RouteMetrics {
  distanceMeters: number;
  durationSeconds: number;
}

interface RouteOptimizationResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  before: RouteMetrics | null;
  after: RouteMetrics | null;
}

export function RouteOptimizationResultDialog({
  open,
  onOpenChange,
  before,
  after,
}: RouteOptimizationResultDialogProps) {
  if (!before || !after) return null;

  const distanceSaved = before.distanceMeters - after.distanceMeters;
  const timeSaved = before.durationSeconds - after.durationSeconds;
  
  const distancePercent = before.distanceMeters > 0 
    ? Math.round((distanceSaved / before.distanceMeters) * 100) 
    : 0;
  const timePercent = before.durationSeconds > 0 
    ? Math.round((timeSaved / before.durationSeconds) * 100) 
    : 0;

  const hasImprovement = distanceSaved > 0 || timeSaved > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Route Optimization Complete
          </DialogTitle>
          <DialogDescription>
            {hasImprovement 
              ? "Your route has been optimized for efficiency." 
              : "Your route was already well-optimized."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Distance comparison */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Distance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatDistance(before.distanceMeters)}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {formatDistance(after.distanceMeters)}
              </span>
              {distanceSaved > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {distancePercent}%
                </Badge>
              )}
            </div>
          </div>

          {/* Duration comparison */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Drive Time</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatDuration(before.durationSeconds)}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {formatDuration(after.durationSeconds)}
              </span>
              {timeSaved > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {timePercent}%
                </Badge>
              )}
            </div>
          </div>

          {/* Summary */}
          {hasImprovement && (
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-center">
                Saved {formatDistance(distanceSaved)} and {formatDuration(timeSaved)}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
