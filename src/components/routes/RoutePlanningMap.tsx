import { useMemo, useState, useCallback } from "react";
import { APIProvider, Map as GoogleMap, Marker, InfoWindow } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Layers, Navigation, Maximize2 } from "lucide-react";
import { ColoredRoutePolyline } from "./ColoredRoutePolyline";
import { GOOGLE_MAPS_API_KEY } from "@/config/google-maps";
import type { Tables } from "@/integrations/supabase/types";
import type { WorkerRoute } from "./MultiWorkerRouteMap";

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
];

interface RoutePlanningMapProps {
  workerRoutes: WorkerRoute[];
  unassignedJobs: Job[];
  selectedWorkerId: string | null;
  onSelectWorker: (id: string | null) => void;
  onAssignJob: (job: Job) => void;
}

export function RoutePlanningMap({
  workerRoutes,
  unassignedJobs,
  selectedWorkerId,
  onSelectWorker,
  onAssignJob,
}: RoutePlanningMapProps) {
  const [selectedJob, setSelectedJob] = useState<{ 
    job: Job; 
    workerName?: string; 
    color?: string;
    isUnassigned?: boolean;
  } | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const apiKey = GOOGLE_MAPS_API_KEY;
  const isPlaceholder = !apiKey || apiKey.includes("YOUR_API_KEY");

  // Assign colors to workers
  const workersWithColors = useMemo(() => {
    return workerRoutes.map((wr, index) => ({
      ...wr,
      color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    }));
  }, [workerRoutes]);

  // Get all jobs with coordinates
  const assignedJobsWithCoords = useMemo(() => {
    return workersWithColors.flatMap((wr) =>
      wr.jobs
        .filter((j) => j.latitude && j.longitude)
        .map((j, idx) => ({
          job: j,
          workerName: wr.userName,
          workerId: wr.userId,
          color: wr.color,
          sequence: idx + 1,
        }))
    );
  }, [workersWithColors]);

  const unassignedJobsWithCoords = useMemo(() => {
    return unassignedJobs.filter((j) => j.latitude && j.longitude);
  }, [unassignedJobs]);

  // Calculate map bounds
  const mapConfig = useMemo(() => {
    const allJobs = [
      ...assignedJobsWithCoords.map((j) => j.job),
      ...unassignedJobsWithCoords,
    ];

    if (allJobs.length === 0) {
      return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 };
    }

    const lats = allJobs.map((j) => j.latitude!);
    const lngs = allJobs.map((j) => j.longitude!);

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
  }, [assignedJobsWithCoords, unassignedJobsWithCoords]);

  const handleMarkerClick = useCallback(
    (job: Job, workerName?: string, color?: string, isUnassigned?: boolean) => {
      setSelectedJob({ job, workerName, color, isUnassigned });
    },
    []
  );

  if (isPlaceholder) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <div className="text-center p-8">
          <Navigation className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Google Maps Not Configured</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your Google Maps API key in Settings to enable interactive route planning.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      {/* Map controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-background/95 backdrop-blur rounded-lg p-2 shadow-lg border">
        <div className="flex items-center gap-2">
          <Switch
            id="traffic"
            checked={showTraffic}
            onCheckedChange={setShowTraffic}
            className="scale-90"
          />
          <Label htmlFor="traffic" className="text-xs cursor-pointer">
            <Layers className="h-3 w-3 inline mr-1" />
            Traffic
          </Label>
        </div>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Legend */}
      {workerRoutes.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border max-w-xs">
          <p className="text-xs font-medium mb-2">Team Routes</p>
          <div className="flex flex-wrap gap-2">
            {workersWithColors.map((wr) => (
              <button
                key={wr.userId}
                onClick={() => onSelectWorker(selectedWorkerId === wr.userId ? null : wr.userId)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${
                  selectedWorkerId === wr.userId
                    ? "ring-2 ring-primary ring-offset-1"
                    : selectedWorkerId && selectedWorkerId !== wr.userId
                    ? "opacity-40"
                    : ""
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: wr.color }}
                />
                <span className="truncate max-w-[80px]">{wr.userName}</span>
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {wr.jobs.length}
                </Badge>
              </button>
            ))}
          </div>
          {unassignedJobsWithCoords.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50 border border-dashed" />
              <span>{unassignedJobsWithCoords.length} unassigned</span>
            </div>
          )}
        </div>
      )}

      <APIProvider apiKey={apiKey}>
        <GoogleMap
          style={{ width: "100%", height: "100%" }}
          defaultCenter={mapConfig.center}
          defaultZoom={mapConfig.zoom}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          {/* Draw polylines for workers */}
          {workersWithColors
            .filter((wr) => wr.routePlan.overview_polyline)
            .filter((wr) => !selectedWorkerId || selectedWorkerId === wr.userId)
            .map((wr) => (
              <ColoredRoutePolyline
                key={wr.userId}
                encodedPath={wr.routePlan.overview_polyline!}
                color={wr.color}
                visible={true}
              />
            ))}

          {/* Assigned job markers */}
          {assignedJobsWithCoords
            .filter((j) => !selectedWorkerId || selectedWorkerId === j.workerId)
            .map(({ job, workerName, color, sequence }) => (
              <Marker
                key={job.id}
                position={{ lat: job.latitude!, lng: job.longitude! }}
                title={`${workerName}: ${job.title}`}
                label={{
                  text: String(sequence),
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "11px",
                }}
                icon={
                  typeof google !== "undefined" && google.maps?.SymbolPath
                    ? {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: color,
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 2,
                      }
                    : undefined
                }
                onClick={() => handleMarkerClick(job, workerName, color)}
              />
            ))}

          {/* Unassigned job markers */}
          {unassignedJobsWithCoords.map((job) => (
            <Marker
              key={job.id}
              position={{ lat: job.latitude!, lng: job.longitude! }}
              title={`Unassigned: ${job.title}`}
              icon={
                typeof google !== "undefined" && google.maps?.SymbolPath
                  ? {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: "#9ca3af",
                      fillOpacity: 0.7,
                      strokeColor: "#6b7280",
                      strokeWeight: 2,
                      strokeOpacity: 1,
                    }
                  : undefined
              }
              onClick={() => handleMarkerClick(job, undefined, undefined, true)}
            />
          ))}

          {/* Info window */}
          {selectedJob && selectedJob.job.latitude && selectedJob.job.longitude && (
            <InfoWindow
              position={{ lat: selectedJob.job.latitude, lng: selectedJob.job.longitude }}
              onCloseClick={() => setSelectedJob(null)}
            >
              <div className="p-2 min-w-[220px]">
                {selectedJob.workerName && selectedJob.color && (
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedJob.color }}
                    />
                    <span className="text-xs font-medium text-gray-600">
                      {selectedJob.workerName}
                    </span>
                  </div>
                )}
                {selectedJob.isUnassigned && (
                  <Badge variant="outline" className="mb-2 text-xs">
                    Unassigned
                  </Badge>
                )}
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
                {selectedJob.isUnassigned && (
                  <Button
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => {
                      onAssignJob(selectedJob.job);
                      setSelectedJob(null);
                    }}
                  >
                    Assign Job
                  </Button>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
