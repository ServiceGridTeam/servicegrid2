import { useState } from "react";
import { useClockEvents, type ClockEvent } from "@/hooks/useClockEvents";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, formatDistanceToNow } from "date-fns";
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
} from "lucide-react";

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

export function ClockEventTimeline({
  jobId,
  defaultOpen = false,
}: ClockEventTimelineProps) {
  const { data: events, isLoading, error } = useClockEvents(jobId);
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
            {/* Export Button */}
            <div className="flex justify-end">
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

            {/* Timeline */}
            <div className="border rounded-lg p-4 bg-card">
              {events.map((event, index) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  isLast={index === events.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
