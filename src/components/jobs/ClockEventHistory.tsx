import { useClockEvents, type ClockEvent } from "@/hooks/useClockEvents";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  Clock, 
  LogIn, 
  LogOut, 
  MapPin, 
  AlertTriangle, 
  CheckCircle,
  Camera,
  FileText,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function EventTypeBadge({ type }: { type: string }) {
  if (type === "clock_in") {
    return (
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
        <LogIn className="h-3 w-3" />
        Clock In
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
      <LogOut className="h-3 w-3" />
      Clock Out
    </Badge>
  );
}

function GeofenceStatus({ event }: { event: ClockEvent }) {
  if (event.within_geofence) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <CheckCircle className="h-3 w-3" />
        Within geofence
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-amber-600">
      <AlertTriangle className="h-3 w-3" />
      {event.distance_from_job_meters
        ? `${Math.round(event.distance_from_job_meters)}m from job site`
        : "Outside geofence"}
    </span>
  );
}

function ClockEventRow({ event }: { event: ClockEvent }) {
  const name = event.profile
    ? `${event.profile.first_name || ""} ${event.profile.last_name || ""}`.trim()
    : "Unknown";

  const initials = event.profile
    ? `${event.profile.first_name?.[0] || ""}${event.profile.last_name?.[0] || ""}`
    : "?";

  const hasOverride = event.override_reason || event.override_photo_url;

  return (
    <div className="flex gap-3 py-3 border-b last:border-0">
      <Avatar className="h-8 w-8 mt-0.5">
        <AvatarImage src={event.profile?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          <EventTypeBadge type={event.event_type} />
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {event.recorded_at
            ? format(new Date(event.recorded_at), "MMM d, yyyy 'at' h:mm a")
            : "Unknown time"}
        </div>

        <GeofenceStatus event={event} />

        {event.latitude && event.longitude && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.latitude.toFixed(5)}, {event.longitude.toFixed(5)}
            {event.accuracy_meters && (
              <span className="text-muted-foreground/60">
                (±{Math.round(event.accuracy_meters)}m)
              </span>
            )}
          </div>
        )}

        {hasOverride && (
          <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-amber-700">
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
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="h-3 w-3" />
                <a
                  href={event.override_photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-primary"
                >
                  View Photo
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ClockEventHistoryProps {
  jobId: string;
  defaultOpen?: boolean;
}

export function ClockEventHistory({ jobId, defaultOpen = false }: ClockEventHistoryProps) {
  const { data: events, isLoading, error } = useClockEvents(jobId);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Failed to load clock events
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No clock events recorded for this job
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Clock Event History
          </span>
          <Badge variant="secondary">{events.length}</Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="border rounded-lg px-3">
          {events.map((event) => (
            <ClockEventRow key={event.id} event={event} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
