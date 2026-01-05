import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin, Clock, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { formatDuration, formatDistance } from "@/hooks/useRouteOptimization";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Job = Tables<"jobs">;

interface SortableRouteJobItemProps {
  job: Job;
  index: number;
  isLast: boolean;
  driveTimeSeconds?: number;
  driveDistanceMeters?: number;
  onJobClick?: (jobId: string) => void;
}

export function SortableRouteJobItem({
  job,
  index,
  isLast,
  driveTimeSeconds,
  driveDistanceMeters,
  onJobClick,
}: SortableRouteJobItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const arrivalTime = job.estimated_arrival
    ? format(parseISO(job.estimated_arrival), "h:mm a")
    : null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-start gap-3 pb-4 group",
          isDragging && "opacity-50"
        )}
      >
        {/* Sequence number with drag handle */}
        <div className="flex flex-col items-center">
          <div
            {...attributes}
            {...listeners}
            className={cn(
              "h-8 w-8 rounded-full bg-secondary flex items-center justify-center cursor-grab relative",
              "hover:ring-2 hover:ring-primary/30 transition-all",
              isDragging && "cursor-grabbing ring-2 ring-primary"
            )}
          >
            <span className="text-sm font-semibold text-secondary-foreground">
              {index + 1}
            </span>
            <GripVertical className="h-3 w-3 text-muted-foreground absolute -right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {!isLast && <div className="w-0.5 flex-1 bg-border mt-2 min-h-[16px]" />}
        </div>

        {/* Job details */}
        <div
          className={cn(
            "flex-1 pt-0.5",
            onJobClick && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
          )}
          onClick={() => onJobClick?.(job.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {[job.address_line1, job.city].filter(Boolean).join(", ") || "No address"}
                </span>
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
          {driveTimeSeconds !== undefined && driveDistanceMeters !== undefined && !isLast && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Car className="h-3 w-3" />
              <span>{formatDuration(driveTimeSeconds)}</span>
              <span>·</span>
              <span>{formatDistance(driveDistanceMeters)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
