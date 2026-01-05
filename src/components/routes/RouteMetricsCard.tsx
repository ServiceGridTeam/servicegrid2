import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Car, Clock, Calendar } from "lucide-react";
import { formatDistance, formatDuration } from "@/hooks/useRouteOptimization";

interface RouteMetricsCardProps {
  jobCount: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  startTime?: string;
  endTime?: string;
  className?: string;
}

export function RouteMetricsCard({
  jobCount,
  totalDistanceMeters,
  totalDurationSeconds,
  startTime,
  endTime,
  className = "",
}: RouteMetricsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{jobCount} jobs</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span>{formatDistance(totalDistanceMeters)}</span>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatDuration(totalDurationSeconds)} drive</span>
          </div>

          {startTime && endTime && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {startTime} → {endTime}
                </span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
