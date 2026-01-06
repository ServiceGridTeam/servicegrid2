import { useState, useMemo, useEffect } from "react";
import { useClockEvents, type ClockEvent } from "@/hooks/useClockEvents";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, formatDistanceToNow, isBefore } from "date-fns";
import {
  Clock,
  LogIn,
  LogOut,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Camera,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  XCircle,
  List,
  Map,
} from "lucide-react";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_API_KEY } from "@/config/google-maps";

interface ClockEventTimelineProps {
  jobId: string;
  defaultOpen?: boolean;
}

function EventTypeBadge({ type, status }: { type: string; status: string }) {
  const isClockIn = type === "clock_in";
  const isBlocked = status === "blocked";
  const isOverride = status === "override";

  if (isBlocked) {
    return (
      <Badge
        variant="outline"
        className="bg-destructive/10 text-destructive border-destructive/20 gap-1"
      >
        <XCircle className="h-3 w-3" />
        Blocked
      </Badge>
    );
  }

  if (isOverride) {
    return (
      <Badge
        variant="outline"
        className="bg-foreground/10 text-foreground border-foreground/20 gap-1"
      >
        <AlertTriangle className="h-3 w-3" />
        Override
      </Badge>
    );
  }

  if (isClockIn) {
    return (
      <Badge
        variant="outline"
        className="bg-success/10 text-success border-success/20 gap-1"
      >
        <LogIn className="h-3 w-3" />
        Clock In
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-info/10 text-info border-info/20 gap-1"
    >
      <LogOut className="h-3 w-3" />
      Clock Out
    </Badge>
  );
}

function GeofenceIndicator({ event }: { event: ClockEvent }) {
  if (event.within_geofence) {
    return (
      <div className="flex items-center gap-1 text-xs text-success">
        <CheckCircle className="h-3 w-3" />
        <span>Within geofence</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-warning">
      <AlertTriangle className="h-3 w-3" />
      <span>
        {event.distance_from_job_meters
          ? `${Math.round(event.distance_from_job_meters)}m from job site`
          : "Outside geofence"}
      </span>
    </div>
  );
}

function TimelineEvent({ event, isLast }: { event: ClockEvent; isLast: boolean }) {
  const name = event.profile
    ? `${event.profile.first_name || ""} ${event.profile.last_name || ""}`.trim()
    : "Unknown";

  const initials = event.profile
    ? `${event.profile.first_name?.[0] || ""}${event.profile.last_name?.[0] || ""}`
    : "?";

  const hasOverride = event.override_reason || event.override_photo_url;
  const isBlocked = event.status === "blocked";
  const isViolation = !event.within_geofence;

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
      )}

      {/* Avatar */}
      <div className="relative z-10">
        <Avatar
          className={`h-8 w-8 border-2 ${
            isBlocked
              ? "border-destructive"
              : isViolation
                ? "border-warning"
                : "border-border"
          }`}
        >
          <AvatarImage src={event.profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Content */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{name}</span>
              <EventTypeBadge type={event.event_type} status={event.status} />
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.recorded_at
                ? format(new Date(event.recorded_at), "MMM d, yyyy 'at' h:mm:ss a")
                : "Unknown time"}
            </div>
            <span className="text-muted-foreground/50">•</span>
            <span>
              {event.recorded_at
                ? formatDistanceToNow(new Date(event.recorded_at), {
                    addSuffix: true,
                  })
                : ""}
            </span>
          </div>

          {/* Geofence Status */}
          <GeofenceIndicator event={event} />

          {/* Location Details */}
          {event.latitude && event.longitude && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>
                {event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}
              </span>
              {event.accuracy_meters && (
                <span className="text-muted-foreground/60">
                  (±{Math.round(event.accuracy_meters)}m accuracy)
                </span>
              )}
            </div>
          )}

          {/* Distance from job */}
          {event.distance_from_job_meters && event.geofence_radius_meters && (
            <div className="text-xs text-muted-foreground">
              Distance: {Math.round(event.distance_from_job_meters)}m / Geofence
              radius: {event.geofence_radius_meters}m
            </div>
          )}

          {/* Override Details */}
          {hasOverride && (
            <div className="mt-2 p-2 rounded bg-foreground/5 border border-foreground/10 space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-foreground/80">
                <AlertTriangle className="h-3 w-3" />
                Override Applied
              </div>
              {event.override_reason && (
                <div className="flex items-start gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{event.override_reason}</span>
                </div>
              )}
              {event.override_photo_url && (
                <div className="flex items-center gap-1 text-xs">
                  <Camera className="h-3 w-3" />
                  <a
                    href={event.override_photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-primary"
                  >
                    View Photo Evidence
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function exportToCsv(events: ClockEvent[], jobId: string) {
  const headers = [
    "Recorded At",
    "Event Type",
    "Status",
    "User",
    "Within Geofence",
    "Distance (m)",
    "Geofence Radius (m)",
    "Latitude",
    "Longitude",
    "Accuracy (m)",
    "Override Reason",
    "Override Photo URL",
  ];

  const rows = events.map((event) => [
    event.recorded_at
      ? format(new Date(event.recorded_at), "yyyy-MM-dd HH:mm:ss")
      : "",
    event.event_type,
    event.status,
    event.profile
      ? `${event.profile.first_name || ""} ${event.profile.last_name || ""}`.trim()
      : "",
    event.within_geofence ? "Yes" : "No",
    event.distance_from_job_meters?.toString() || "",
    event.geofence_radius_meters?.toString() || "",
    event.latitude?.toString() || "",
    event.longitude?.toString() || "",
    event.accuracy_meters?.toString() || "",
    event.override_reason || "",
    event.override_photo_url || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `clock-events-${jobId}-${format(new Date(), "yyyy-MM-dd")}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Geofence circle component
function GeofenceCircle({ 
  center, 
  radius, 
  isExpanded = false 
}: { 
  center: { lat: number; lng: number }; 
  radius: number;
  isExpanded?: boolean;
}) {
  const map = useMap();

  useMemo(() => {
    if (!map || !window.google?.maps) return;

    const circle = new window.google.maps.Circle({
      center,
      radius,
      fillColor: isExpanded ? "#f59e0b" : "#3b82f6",
      fillOpacity: 0.1,
      strokeColor: isExpanded ? "#f59e0b" : "#3b82f6",
      strokeWeight: 2,
      strokeOpacity: 0.6,
      map,
    });

    return () => circle.setMap(null);
  }, [map, center, radius, isExpanded]);

  return null;
}

// Helper to get color based on time gap
function getTimeGapColor(gapMinutes: number): string {
  if (gapMinutes < 5) return '#22c55e'; // green - quick transition
  if (gapMinutes <= 30) return '#eab308'; // yellow - moderate delay
  return '#ef4444'; // red - long gap
}

// Color-coded path connecting clock events with segments based on time gaps
function ColorCodedPath({ events }: { events: ClockEvent[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps || events.length < 2) return;

    // Sort by recorded_at ascending (oldest first)
    const sortedEvents = [...events]
      .filter(e => e.latitude && e.longitude && e.recorded_at)
      .sort((a, b) => 
        new Date(a.recorded_at!).getTime() - new Date(b.recorded_at!).getTime()
      );

    if (sortedEvents.length < 2) return;

    const polylines: google.maps.Polyline[] = [];

    // Create individual segments between consecutive events
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const current = sortedEvents[i];
      const next = sortedEvents[i + 1];
      
      // Calculate time gap in minutes
      const gapMinutes = (
        new Date(next.recorded_at!).getTime() - 
        new Date(current.recorded_at!).getTime()
      ) / (1000 * 60);

      const strokeColor = getTimeGapColor(gapMinutes);

      const segment = new google.maps.Polyline({
        path: [
          { lat: current.latitude!, lng: current.longitude! },
          { lat: next.latitude!, lng: next.longitude! },
        ],
        strokeColor,
        strokeOpacity: 0.8,
        strokeWeight: 3,
        geodesic: true,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 2.5,
            strokeColor,
            fillColor: strokeColor,
            fillOpacity: 1,
          },
          offset: '50%',
        }],
        map,
      });

      polylines.push(segment);
    }

    return () => polylines.forEach(p => p.setMap(null));
  }, [map, events]);

  return null;
}

// Legend for the color-coded path
function PathLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-green-500 rounded" />
        <span>&lt;5 min</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-yellow-500 rounded" />
        <span>5-30 min</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5 bg-red-500 rounded" />
        <span>&gt;30 min</span>
      </div>
    </div>
  );
}

// Map component showing clock events
function ClockEventMap({ 
  events, 
  job 
}: { 
  events: ClockEvent[];
  job: { 
    latitude: number | null; 
    longitude: number | null; 
    geofence_radius_meters: number | null;
    geofence_expanded_radius_meters: number | null;
    geofence_expanded_until: string | null;
  } | null;
}) {
  const [selectedEvent, setSelectedEvent] = useState<ClockEvent | null>(null);

  // Filter events with valid coordinates
  const validEvents = events.filter(e => e.latitude && e.longitude);

  // Sort events chronologically and create sequence lookup
  const sortedEvents = useMemo(() => {
    return [...validEvents]
      .filter(e => e.recorded_at)
      .sort((a, b) => 
        new Date(a.recorded_at!).getTime() - new Date(b.recorded_at!).getTime()
      );
  }, [validEvents]);

  const eventSequenceMap = useMemo(() => {
    const seqMap: Record<string, number> = {};
    sortedEvents.forEach((event, index) => {
      seqMap[event.id] = index + 1;
    });
    return seqMap;
  }, [sortedEvents]);
  
  if (!job?.latitude || !job?.longitude) {
    return (
      <div className="h-[300px] border rounded-lg flex items-center justify-center bg-muted/50">
        <p className="text-muted-foreground text-sm">Job location not available</p>
      </div>
    );
  }

  // Check if geofence is currently expanded
  const isExpanded = job.geofence_expanded_until && 
    job.geofence_expanded_radius_meters &&
    isBefore(new Date(), new Date(job.geofence_expanded_until));

  const effectiveRadius = isExpanded 
    ? job.geofence_expanded_radius_meters! 
    : (job.geofence_radius_meters || 100);

  const jobCenter = { lat: job.latitude, lng: job.longitude };

  return (
    <div className="space-y-2">
      <div className="h-[300px] border rounded-lg overflow-hidden relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <GoogleMap
            defaultCenter={jobCenter}
            defaultZoom={17}
            mapId="clock-event-map"
            gestureHandling="cooperative"
            disableDefaultUI={false}
            zoomControl={true}
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={false}
          >
            {/* Geofence Circle */}
            <GeofenceCircle 
              center={jobCenter} 
              radius={effectiveRadius} 
              isExpanded={isExpanded ?? false}
            />

            {/* Color-Coded Path */}
            <ColorCodedPath events={validEvents} />

            {/* Job Site Marker */}
            <AdvancedMarker position={jobCenter}>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-background">
                <MapPin className="h-4 w-4" />
              </div>
            </AdvancedMarker>

            {/* Clock Event Markers with Sequence Badges */}
            {validEvents.map((event) => {
              const isClockIn = event.event_type === "clock_in";
              const isViolation = !event.within_geofence;
              const hasOverride = event.override_reason || event.override_photo_url;
              const sequenceNumber = eventSequenceMap[event.id];

              return (
                <AdvancedMarker
                  key={event.id}
                  position={{ lat: event.latitude!, lng: event.longitude! }}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                >
                  <div className="relative">
                    {/* Main Marker */}
                    <div 
                      className={`
                        flex items-center justify-center w-7 h-7 rounded-full shadow-md cursor-pointer
                        transition-transform hover:scale-110
                        ${isClockIn ? "bg-success" : "bg-info"}
                        ${isViolation ? "ring-2 ring-destructive ring-offset-1" : ""}
                        ${hasOverride ? "ring-2 ring-warning ring-offset-1" : ""}
                      `}
                    >
                      {isClockIn ? (
                        <LogIn className="h-3.5 w-3.5 text-success-foreground" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5 text-info-foreground" />
                      )}
                    </div>
                    {/* Sequence Badge */}
                    {sequenceNumber && (
                      <div className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full bg-background border-2 border-foreground text-[10px] font-bold shadow-sm">
                        {sequenceNumber}
                      </div>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}
          </GoogleMap>
        </APIProvider>

        {/* Selected Event Info Panel */}
        {selectedEvent && (
          <div className="absolute bottom-2 left-2 right-2 bg-card border rounded-lg p-3 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <EventTypeBadge type={selectedEvent.event_type} status={selectedEvent.status} />
                <span className="text-xs text-muted-foreground">
                  {selectedEvent.recorded_at
                    ? format(new Date(selectedEvent.recorded_at), "MMM d, h:mm a")
                    : "Unknown time"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSelectedEvent(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <GeofenceIndicator event={selectedEvent} />
              {selectedEvent.distance_from_job_meters && (
                <span>• {Math.round(selectedEvent.distance_from_job_meters)}m from job</span>
              )}
            </div>
            {selectedEvent.override_reason && (
              <div className="mt-1 text-xs text-warning truncate">
                Override: {selectedEvent.override_reason}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Path Legend */}
      <PathLegend />
    </div>
  );
}

export function ClockEventTimeline({
  jobId,
  defaultOpen = false,
}: ClockEventTimelineProps) {
  const { data: events, isLoading, error } = useClockEvents(jobId);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Fetch job data for geofence visualization
  const { data: job } = useQuery({
    queryKey: ["job-geofence", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("latitude, longitude, geofence_radius_meters, geofence_expanded_radius_meters, geofence_expanded_until")
        .eq("id", jobId)
        .single();
      return data;
    },
    enabled: isOpen && viewMode === "map",
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Failed to load clock events
      </div>
    );
  }

  const eventCount = events?.length || 0;
  const overrideCount =
    events?.filter((e) => e.override_reason || e.override_photo_url).length || 0;
  const violationCount = events?.filter((e) => !e.within_geofence).length || 0;

  // Check if any events have coordinates for map view
  const hasLocationData = events?.some(e => e.latitude && e.longitude);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <History className="h-4 w-4" />
            Clock Event Timeline
          </span>
          <div className="flex items-center gap-2">
            {violationCount > 0 && (
              <Badge variant="outline" className="text-warning border-warning/20">
                {violationCount} violation{violationCount !== 1 ? "s" : ""}
              </Badge>
            )}
            {overrideCount > 0 && (
              <Badge variant="outline" className="text-foreground/70">
                {overrideCount} override{overrideCount !== 1 ? "s" : ""}
              </Badge>
            )}
            <Badge variant="secondary">{eventCount}</Badge>
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3">
        {!events || events.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            No clock events recorded for this job
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toolbar: View Toggle + Export */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-7 gap-1.5"
                >
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button
                  variant={viewMode === "map" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  disabled={!hasLocationData}
                  className="h-7 gap-1.5"
                  title={!hasLocationData ? "No location data available" : undefined}
                >
                  <Map className="h-3.5 w-3.5" />
                  Map
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(events, jobId)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Content: Map or List */}
            {viewMode === "map" ? (
              <div className="relative">
                <ClockEventMap events={events} job={job ?? null} />
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-card">
                {events.map((event, index) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    isLast={index === events.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
