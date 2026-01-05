import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkerStatuses, type WorkerStatus } from "@/hooks/useWorkerStatuses";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, MapPin } from "lucide-react";
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function WorkerMarker({ worker }: { worker: WorkerStatus }) {
  const name = worker.profile
    ? `${worker.profile.first_name || ""} ${worker.profile.last_name || ""}`.trim()
    : "Unknown";

  const statusColors: Record<string, string> = {
    available: "#22c55e",
    on_job: "#3b82f6",
    traveling: "#f59e0b",
    break: "#f97316",
    offline: "#6b7280",
  };

  const color = statusColors[worker.current_status] || statusColors.offline;

  if (!worker.current_location_lat || !worker.current_location_lng) {
    return null;
  }

  return (
    <AdvancedMarker
      position={{
        lat: worker.current_location_lat,
        lng: worker.current_location_lng,
      }}
      title={name}
    >
      <div className="relative">
        <Pin
          background={color}
          borderColor={color}
          glyphColor="#fff"
        />
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-background/90 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm border">
          {worker.profile?.first_name || "Worker"}
        </div>
      </div>
    </AdvancedMarker>
  );
}

export function WorkerStatusMap() {
  const { data: workers, isLoading } = useWorkerStatuses();

  const workersWithLocation = useMemo(() => {
    return (workers || []).filter(
      (w) => w.current_location_lat && w.current_location_lng
    );
  }, [workers]);

  const mapCenter = useMemo(() => {
    if (workersWithLocation.length === 0) {
      return { lat: 33.749, lng: -84.388 }; // Default: Atlanta
    }
    const avgLat =
      workersWithLocation.reduce((sum, w) => sum + (w.current_location_lat || 0), 0) /
      workersWithLocation.length;
    const avgLng =
      workersWithLocation.reduce((sum, w) => sum + (w.current_location_lng || 0), 0) /
      workersWithLocation.length;
    return { lat: avgLat, lng: avgLng };
  }, [workersWithLocation]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Team Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Google Maps API key not configured.
          <br />
          <span className="text-xs">Add VITE_GOOGLE_MAPS_API_KEY to see the map.</span>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Team Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="h-5 w-5" />
          Team Locations
          {workersWithLocation.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-auto">
              {workersWithLocation.length} active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workersWithLocation.length === 0 ? (
          <div className="h-[300px] rounded-lg bg-muted/50 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No workers currently sharing location
              <br />
              <span className="text-xs">Locations update when workers clock in</span>
            </div>
          </div>
        ) : (
          <div className="h-[300px] rounded-lg overflow-hidden">
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <GoogleMap
                defaultCenter={mapCenter}
                defaultZoom={11}
                mapId="worker-status-map"
                disableDefaultUI={false}
                gestureHandling="cooperative"
              >
                {workersWithLocation.map((worker) => (
                  <WorkerMarker key={worker.id} worker={worker} />
                ))}
              </GoogleMap>
            </APIProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
