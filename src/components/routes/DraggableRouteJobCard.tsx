import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Clock, 
  AlertCircle,
  GripVertical
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface DraggableRouteJobCardProps {
  job: Job;
  onSmartAssign?: () => void;
}

export function DraggableRouteJobCard({
  job,
  onSmartAssign,
}: DraggableRouteJobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `job-${job.id}`,
    data: {
      type: "job",
      job,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "text-destructive bg-destructive/10";
      case "high":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg border bg-card transition-colors group cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-xl ring-2 ring-primary/50 z-50" : "hover:bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="h-4 w-4 text-muted-foreground/50 mt-0.5 group-hover:text-muted-foreground transition-colors">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm leading-tight truncate">
              {job.title}
            </h4>
            {(job.priority === "urgent" || job.priority === "high") && (
              <Badge 
                variant="outline" 
                className={`shrink-0 text-[10px] px-1.5 ${getPriorityColor(job.priority)}`}
              >
                {job.priority}
              </Badge>
            )}
          </div>

          {(job.address_line1 || job.city) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {[job.address_line1, job.city].filter(Boolean).join(", ")}
              </span>
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {job.estimated_duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {job.estimated_duration_minutes}m
              </span>
            )}
            {job.scheduled_start && (
              <span>
                {format(new Date(job.scheduled_start), "MMM d")}
              </span>
            )}
            {!job.latitude && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No location
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
