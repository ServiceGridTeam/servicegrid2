import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, GripVertical } from "lucide-react";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

interface DraggableUnscheduledCardProps {
  job: JobWithCustomer;
  onClick: () => void;
  onSchedule: () => void;
}

const priorityColors: Record<string, string> = {
  high: "border-l-destructive",
  normal: "border-l-primary",
  low: "border-l-muted-foreground",
};

export function DraggableUnscheduledCard({
  job,
  onClick,
  onSchedule,
}: DraggableUnscheduledCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${job.id}`,
    data: { job, type: "unscheduled" },
  });

  const customerName = job.customer
    ? `${job.customer.first_name} ${job.customer.last_name}`
    : "";

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
      }
    : undefined;

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all border-l-4",
        priorityColors[job.priority || "normal"],
        isDragging && "opacity-50 shadow-xl"
      )}
      style={dragStyle}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <div
              className="mt-1 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">
                {job.title || job.job_number}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {customerName}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
