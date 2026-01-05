import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Clock, Car, Home, Navigation, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatDistance, formatDuration, parseRouteLegs, RouteLeg } from "@/hooks/useRouteOptimization";
import { RouteMetricsCard } from "./RouteMetricsCard";
import type { DailyRoutePlan } from "@/types/routePlanning";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface DailyRouteViewProps {
  routePlan: DailyRoutePlan | null;
  jobs: Job[];
  isLoading?: boolean;
  onJobClick?: (jobId: string) => void;
  workerName?: string;
}

export function DailyRouteView({
  routePlan,
  jobs,
  isLoading = false,
  onJobClick,
  workerName,
}: DailyRouteViewProps) {
  // Sort jobs by route sequence
  const orderedJobs = useMemo(() => {
    if (!routePlan?.job_ids) return jobs;

    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    return routePlan.job_ids
      .map((id) => jobMap.get(id))
      .filter((j): j is Job => j !== undefined);
  }, [routePlan, jobs]);

  const legs = useMemo(() => parseRouteLegs(routePlan?.legs), [routePlan?.legs]);

  const startLocation = routePlan?.start_location as { lat: number; lng: number } | null;
  const endLocation = routePlan?.end_location as { lat: number; lng: number } | null;

  // Calculate start/end times
  const startTime = orderedJobs[0]?.estimated_arrival
    ? format(parseISO(orderedJobs[0].estimated_arrival), "h:mm a")
    : "8:00 AM";

  const lastJob = orderedJobs[orderedJobs.length - 1];
  const endTime = lastJob?.estimated_arrival
    ? format(
        new Date(
          parseISO(lastJob.estimated_arrival).getTime() +
            (lastJob.estimated_duration_minutes || 60) * 60 * 1000
        ),
        "h:mm a"
      )
    : null;

  // Build Google Maps directions URL
  const googleMapsUrl = useMemo(() => {
    if (orderedJobs.length === 0) return null;

    const waypoints = orderedJobs
      .filter((j) => j.latitude && j.longitude)
      .map((j) => `${j.latitude},${j.longitude}`);

    if (waypoints.length === 0) return null;

    const origin = startLocation
      ? `${startLocation.lat},${startLocation.lng}`
      : waypoints[0];
    const destination = endLocation
      ? `${endLocation.lat},${endLocation.lng}`
      : waypoints[waypoints.length - 1];
    const intermediates = waypoints.slice(
      startLocation ? 0 : 1,
      endLocation ? undefined : -1
    );

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    if (intermediates.length > 0) {
      url += `&waypoints=${intermediates.join("|")}`;
    }

    return url;
  }, [orderedJobs, startLocation, endLocation]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!routePlan || orderedJobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Navigation className="mx-auto h-12 w-12 mb-3 opacity-50" />
          <p>No optimized route for this day</p>
          <p className="text-sm mt-1">Assign jobs and optimize the route to see the schedule</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <RouteMetricsCard
        jobCount={orderedJobs.length}
        totalDistanceMeters={routePlan.total_distance_meters || 0}
        totalDurationSeconds={routePlan.total_duration_seconds || 0}
        startTime={startTime}
        endTime={endTime || undefined}
      />

      {/* Actions */}
      {googleMapsUrl && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" asChild>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Google Maps
            </a>
          </Button>
        </div>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            {workerName ? `${workerName}'s Route` : "Daily Route"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative">
            {/* Start location */}
            {startLocation && (
              <div className="flex items-start gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Home className="h-4 w-4 text-primary" />
                  </div>
                  <div className="w-0.5 flex-1 bg-border mt-2" />
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-medium text-sm">Start: Home</p>
                  {legs[0] && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span>{formatDuration(legs[0].durationSeconds)}</span>
                      <span>·</span>
                      <span>{formatDistance(legs[0].distanceMeters)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Jobs */}
            {orderedJobs.map((job, index) => {
              const isLast = index === orderedJobs.length - 1;
              const leg = legs[startLocation ? index + 1 : index];
              const arrivalTime = job.estimated_arrival
                ? format(parseISO(job.estimated_arrival), "h:mm a")
                : null;

              return (
                <div key={job.id} className="flex items-start gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-semibold text-secondary-foreground">
                        {index + 1}
                      </span>
                    </div>
                    {(!isLast || endLocation) && (
                      <div className="w-0.5 flex-1 bg-border mt-2" />
                    )}
                  </div>

                  <div
                    className={`flex-1 pt-0.5 ${onJobClick ? "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors" : ""}`}
                    onClick={() => onJobClick?.(job.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[job.address_line1, job.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                      {arrivalTime && (
                        <Badge variant="outline" className="text-xs shrink-0 ml-2">
                          <Clock className="h-3 w-3 mr-1" />
                          {arrivalTime}
                        </Badge>
                      )}
                    </div>

                    {job.estimated_duration_minutes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Est. {job.estimated_duration_minutes} min
                      </p>
                    )}

                    {/* Drive time to next stop */}
                    {leg && !isLast && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Car className="h-3 w-3" />
                        <span>{formatDuration(leg.durationSeconds)}</span>
                        <span>·</span>
                        <span>{formatDistance(leg.distanceMeters)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* End location */}
            {endLocation && (
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Home className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-medium text-sm">End: Home</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
