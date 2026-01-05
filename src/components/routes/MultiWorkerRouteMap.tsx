import { useMemo, useState, useCallback } from "react";
import { APIProvider, Map as GoogleMap, Marker, InfoWindow, AdvancedMarker } from "@vis.gl/react-google-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, Layers, Route as RouteIcon } from "lucide-react";
import { ColoredRoutePolyline } from "./ColoredRoutePolyline";
import { WorkerRouteLegend } from "./WorkerRouteLegend";
import type { DailyRoutePlan } from "@/types/routePlanning";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

const ROUTE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f97316", // orange
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#ef4444", // red
  "#6366f1", // indigo
  "#84cc16", // lime
];

export interface WorkerRoute {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  routePlan: DailyRoutePlan;
  jobs: Job[];
}

interface MultiWorkerRouteMapProps {
  workerRoutes: WorkerRoute[];
  isLoading?: boolean;
  onJobClick?: (jobId: string) => void;
  height?: string;
}

export function MultiWorkerRouteMap({
  workerRoutes,
  isLoading = false,
  onJobClick,
  height = "500px",
}: MultiWorkerRouteMapProps) {
  const [selectedJob, setSelectedJob] = useState<{ job: Job; workerName: string; color: string } | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [visibleWorkers, setVisibleWorkers] = useState<Set<string>>(
    new Set(workerRoutes.map((w) => w.userId))
  );

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Assign colors to workers
  const workersWithColors = useMemo(() => {
    return workerRoutes.map((wr, index) => ({
      ...wr,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    }));
  }, [workerRoutes]);

  // Get all jobs with coordinates from visible workers
  const allJobsWithCoords = useMemo(() => {
    return workersWithColors
      .filter((wr) => visibleWorkers.has(wr.userId))
      .flatMap((wr) =>
        wr.jobs
          .filter((j) => j.latitude && j.longitude)
          .map((j, idx) => ({
            job: j,
            workerName: wr.userName,
            color: wr.color,
            sequence: idx + 1,
          }))
      );
  }, [workersWithColors, visibleWorkers]);

  // Calculate map bounds
  const mapConfig = useMemo(() => {
    if (allJobsWithCoords.length === 0) {
      return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 };
    }

    const lats = allJobsWithCoords.map((j) => j.job.latitude!);
    const lngs = allJobsWithCoords.map((j) => j.job.longitude!);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let calculatedZoom = 12;
    if (maxDiff > 5) calculatedZoom = 6;
    else if (maxDiff > 2) calculatedZoom = 8;
    else if (maxDiff > 0.5) calculatedZoom = 10;
    else if (maxDiff > 0.1) calculatedZoom = 12;
    else calculatedZoom = 14;

    return { center: { lat: centerLat, lng: centerLng }, zoom: calculatedZoom };
  }, [allJobsWithCoords]);

  const { center, zoom } = mapConfig;

  // Legend data
  const legendWorkers = useMemo(() => {
    return workersWithColors.map((wr) => ({
      userId: wr.userId,
      userName: wr.userName,
      avatarUrl: wr.avatarUrl,
      color: wr.color,
      jobCount: wr.jobs.filter((j) => j.latitude && j.longitude).length,
      distanceMeters: wr.routePlan.total_distance_meters || 0,
      durationSeconds: wr.routePlan.total_duration_seconds || 0,
      visible: visibleWorkers.has(wr.userId),
    }));
  }, [workersWithColors, visibleWorkers]);

  // Summary for visible routes
  const summary = useMemo(() => {
    const visible = legendWorkers.filter((w) => w.visible);
    return {
      totalJobs: visible.reduce((sum, w) => sum + w.jobCount, 0),
      totalDistance: visible.reduce((sum, w) => sum + w.distanceMeters, 0),
      totalDuration: visible.reduce((sum, w) => sum + w.durationSeconds, 0),
    };
  }, [legendWorkers]);

  const handleToggleVisibility = useCallback((userId: string) => {
    setVisibleWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((visible: boolean) => {
    if (visible) {
      setVisibleWorkers(new Set(workerRoutes.map((w) => w.userId)));
    } else {
      setVisibleWorkers(new Set());
    }
  }, [workerRoutes]);

  const handleMarkerClick = useCallback(
    (job: Job, workerName: string, color: string) => {
      setSelectedJob({ job, workerName, color });
    },
    []
  );

  if (!apiKey) {
    return (
      <Card style={{ height }}>
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground text-center">
            Google Maps API key not configured.
            <br />
            <span className="text-sm">Add VITE_GOOGLE_MAPS_API_KEY to enable maps.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  const hasRoutes = workerRoutes.length > 0;

  const formatDistance = (meters: number) => `${(meters / 1609.34).toFixed(1)} mi`;
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <Card className="overflow-hidden flex flex-col" style={{ height }}>
      <CardHeader className="py-3 flex-row items-center justify-between space-y-0 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          All Team Routes
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="traffic-multi"
              checked={showTraffic}
              onCheckedChange={setShowTraffic}
            />
            <Label htmlFor="traffic-multi" className="text-sm">
              <Layers className="h-4 w-4 inline mr-1" />
              Traffic
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0 relative">
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            style={{ width: "100%", height: "100%" }}
            defaultCenter={center}
            defaultZoom={zoom}
            gestureHandling="cooperative"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={true}
          >
            {/* Draw polylines for visible workers */}
            {workersWithColors
              .filter((wr) => visibleWorkers.has(wr.userId) && wr.routePlan.overview_polyline)
              .map((wr) => (
                <ColoredRoutePolyline
                  key={wr.userId}
                  encodedPath={wr.routePlan.overview_polyline!}
                  color={wr.color}
                  visible={true}
                />
              ))}

            {/* Job markers */}
            {allJobsWithCoords.map(({ job, workerName, color, sequence }) => (
              <Marker
                key={job.id}
                position={{ lat: job.latitude!, lng: job.longitude! }}
                title={`${workerName}: ${job.title}`}
                label={{
                  text: String(sequence),
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 14,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
                onClick={() => handleMarkerClick(job, workerName, color)}
              />
            ))}

            {/* Info window for selected job */}
            {selectedJob && selectedJob.job.latitude && selectedJob.job.longitude && (
              <InfoWindow
                position={{ lat: selectedJob.job.latitude, lng: selectedJob.job.longitude }}
                onCloseClick={() => setSelectedJob(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedJob.color }}
                    />
                    <span className="text-xs font-medium text-gray-600">
                      {selectedJob.workerName}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm">{selectedJob.job.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {[selectedJob.job.address_line1, selectedJob.job.city, selectedJob.job.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {selectedJob.job.estimated_duration_minutes && (
                    <p className="text-xs text-gray-500 mt-1">
                      Est. {selectedJob.job.estimated_duration_minutes} min
                    </p>
                  )}
                  {onJobClick && (
                    <Button
                      size="sm"
                      variant="link"
                      className="p-0 h-auto mt-2"
                      onClick={() => {
                        onJobClick(selectedJob.job.id);
                        setSelectedJob(null);
                      }}
                    >
                      View Details →
                    </Button>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>

        {/* Empty state overlay */}
        {!hasRoutes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-background/80 backdrop-blur-sm rounded-lg p-6 text-center shadow-lg">
              <RouteIcon className="mx-auto h-10 w-10 mb-2 text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">No routes for this date</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Create jobs and optimize routes to see them here
              </p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Legend - only show if there are workers */}
      {hasRoutes && (
        <WorkerRouteLegend
          workers={legendWorkers}
          onToggleVisibility={handleToggleVisibility}
          onToggleAll={handleToggleAll}
        />
      )}

      {/* Summary bar - only show if there are routes */}
      {hasRoutes && (
        <div className="border-t bg-muted/50 px-4 py-2 text-sm text-muted-foreground shrink-0">
          <span className="font-medium text-foreground">{summary.totalJobs}</span> jobs •{" "}
          <span className="font-medium text-foreground">{formatDistance(summary.totalDistance)}</span> •{" "}
          <span className="font-medium text-foreground">{formatDuration(summary.totalDuration)}</span> drive time
        </div>
      )}
    </Card>
  );
}
