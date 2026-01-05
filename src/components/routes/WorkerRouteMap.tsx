import { useMemo, useState, useCallback } from "react";
import { APIProvider, Map as GoogleMap, Marker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, ExternalLink, Layers } from "lucide-react";
import { GOOGLE_MAPS_API_KEY } from "@/config/google-maps";
import type { DailyRoutePlan } from "@/types/routePlanning";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface WorkerRouteMapProps {
  routePlan: DailyRoutePlan | null;
  jobs: Job[];
  isLoading?: boolean;
  onJobClick?: (jobId: string) => void;
  height?: string;
}

// Decode Google Maps encoded polyline
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// Component to draw polyline on map
function RoutePolyline({ encodedPath }: { encodedPath: string }) {
  const map = useMap();

  useMemo(() => {
    if (!map || !encodedPath) return;

    const path = decodePolyline(encodedPath);
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: "#3b82f6",
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map,
    });

    return () => polyline.setMap(null);
  }, [map, encodedPath]);

  return null;
}

export function WorkerRouteMap({
  routePlan,
  jobs,
  isLoading = false,
  onJobClick,
  height = "400px",
}: WorkerRouteMapProps) {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showTraffic, setShowTraffic] = useState(false);

  const apiKey = GOOGLE_MAPS_API_KEY;
  const isPlaceholder = !apiKey || apiKey.includes("YOUR_API_KEY");

  // Sort jobs by route sequence
  const orderedJobs = useMemo(() => {
    if (!routePlan?.job_ids) return jobs.filter((j) => j.latitude && j.longitude);

    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    return routePlan.job_ids
      .map((id) => jobMap.get(id))
      .filter((j): j is Job => j !== undefined && j.latitude !== null && j.longitude !== null);
  }, [routePlan, jobs]);

  // Calculate map center and bounds
  const mapConfig = useMemo(() => {
    if (orderedJobs.length === 0) {
      return { center: { lat: 39.8283, lng: -98.5795 }, zoom: 4 }; // US center
    }

    const lats = orderedJobs.map((j) => j.latitude!);
    const lngs = orderedJobs.map((j) => j.longitude!);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Rough zoom calculation based on bounds
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
  }, [orderedJobs]);

  const { center, zoom } = mapConfig;

  const startLocation = routePlan?.start_location as { lat: number; lng: number } | null;
  const endLocation = routePlan?.end_location as { lat: number; lng: number } | null;

  const handleMarkerClick = useCallback((job: Job) => {
    setSelectedJob(job);
  }, []);

  if (isPlaceholder) {
    return (
      <Card style={{ height }}>
        <CardContent className="flex items-center justify-center h-full">
          <p className="text-muted-foreground text-center">
            Google Maps API key not configured.
            <br />
            <span className="text-sm">Update src/config/google-maps.ts with your API key.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  const hasNoJobs = orderedJobs.length === 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Route Map
        </CardTitle>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="traffic"
              checked={showTraffic}
              onCheckedChange={setShowTraffic}
            />
            <Label htmlFor="traffic" className="text-sm">
              <Layers className="h-4 w-4 inline mr-1" />
              Traffic
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        {/* Show overlay if no jobs */}
        {hasNoJobs && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center text-muted-foreground p-4">
              <MapPin className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">No jobs with coordinates yet</p>
              <p className="text-sm mt-1">Add addresses to jobs and geocode them to see them on the map</p>
            </div>
          </div>
        )}
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            style={{ width: "100%", height }}
            defaultCenter={center}
            defaultZoom={zoom}
            gestureHandling="cooperative"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={true}
          >
            {/* Draw route polyline */}
            {routePlan?.overview_polyline && (
              <RoutePolyline encodedPath={routePlan.overview_polyline} />
            )}

            {/* Start location marker */}
            {startLocation && (
              <Marker
                position={{ lat: startLocation.lat, lng: startLocation.lng }}
                title="Start"
                label={{
                  text: "S",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            )}

            {/* Job markers */}
            {orderedJobs.map((job, index) => (
              <Marker
                key={job.id}
                position={{ lat: job.latitude!, lng: job.longitude! }}
                title={job.title}
                label={{
                  text: String(index + 1),
                  color: "white",
                  fontWeight: "bold",
                }}
                onClick={() => handleMarkerClick(job)}
              />
            ))}

            {/* End location marker */}
            {endLocation && endLocation !== startLocation && (
              <Marker
                position={{ lat: endLocation.lat, lng: endLocation.lng }}
                title="End"
                label={{
                  text: "E",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            )}

            {/* Info window for selected job */}
            {selectedJob && selectedJob.latitude && selectedJob.longitude && (
              <InfoWindow
                position={{ lat: selectedJob.latitude, lng: selectedJob.longitude }}
                onCloseClick={() => setSelectedJob(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <h3 className="font-semibold text-sm">{selectedJob.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {[selectedJob.address_line1, selectedJob.city, selectedJob.state]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {selectedJob.estimated_duration_minutes && (
                    <p className="text-xs text-gray-500 mt-1">
                      Est. {selectedJob.estimated_duration_minutes} min
                    </p>
                  )}
                  {onJobClick && (
                    <Button
                      size="sm"
                      variant="link"
                      className="p-0 h-auto mt-2"
                      onClick={() => {
                        onJobClick(selectedJob.id);
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
      </CardContent>
    </Card>
  );
}
