import { useState, useRef, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { format, differenceInMinutes, addMinutes } from "date-fns";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DraggableJobCardProps {
  job: JobWithCustomer;
  variant?: "month" | "week" | "day";
  onClick?: (job: JobWithCustomer) => void;
  onResize?: (job: JobWithCustomer, newEndTime: Date) => void;
  className?: string;
  style?: React.CSSProperties;
  hasConflict?: boolean;
  conflictMessage?: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
  in_progress: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
  cancelled: "bg-muted border-muted-foreground/20 text-muted-foreground",
};

const SNAP_MINUTES = 15;

export function DraggableJobCard({
  job,
  variant = "month",
  onClick,
  onResize,
  className,
  style,
  hasConflict,
  conflictMessage,
}: DraggableJobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job, type: "job" },
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizePreview, setResizePreview] = useState<number | null>(null);
  const resizeStartY = useRef<number>(0);
  const originalHeight = useRef<number>(0);

  const statusColor = statusColors[job.status || "scheduled"] || statusColors.scheduled;
  const startTime = job.scheduled_start ? format(new Date(job.scheduled_start), "h:mm a") : "";
  const endTime = job.scheduled_end ? format(new Date(job.scheduled_end), "h:mm a") : "";
  const customerName = job.customer
    ? `${job.customer.first_name} ${job.customer.last_name}`
    : "";

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!onResize || variant === "month") return;
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      resizeStartY.current = e.clientY;
      originalHeight.current = (e.target as HTMLElement).parentElement?.offsetHeight || 0;
    },
    [onResize, variant]
  );

  const handleResizeMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isResizing) return;
      const deltaY = e.clientY - resizeStartY.current;
      const newHeight = Math.max(30, originalHeight.current + deltaY);
      setResizePreview(newHeight);
    },
    [isResizing]
  );

  const handleResizeEnd = useCallback(
    (e: React.MouseEvent) => {
      if (!isResizing || !onResize || !job.scheduled_start) return;
      e.stopPropagation();
      setIsResizing(false);

      if (resizePreview !== null) {
        // Calculate new duration based on pixel height
        // Assume HOUR_HEIGHT is 60px for week view, 80px for day view
        const hourHeight = variant === "day" ? 80 : 60;
        const newDurationMinutes = Math.round((resizePreview / hourHeight) * 60);
        const snappedMinutes = Math.round(newDurationMinutes / SNAP_MINUTES) * SNAP_MINUTES;
        const clampedMinutes = Math.max(30, Math.min(480, snappedMinutes)); // 30 min to 8 hours

        const start = new Date(job.scheduled_start);
        const newEnd = addMinutes(start, clampedMinutes);
        onResize(job, newEnd);
      }

      setResizePreview(null);
    },
    [isResizing, resizePreview, job, onResize, variant]
  );

  const dragStyle = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  const cardContent = (
    <div
      ref={setNodeRef}
      className={cn(
        "border cursor-grab active:cursor-grabbing transition-all relative",
        statusColor,
        isDragging && "opacity-50 shadow-lg",
        hasConflict && "ring-2 ring-destructive ring-offset-1",
        variant === "month" && "text-xs p-1 rounded truncate",
        variant === "week" && "text-xs p-1.5 rounded overflow-hidden",
        variant === "day" && "p-3 rounded-lg",
        className
      )}
      style={{ ...style, ...dragStyle, height: resizePreview ?? style?.height }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging && !isResizing) {
          e.stopPropagation();
          onClick?.(job);
        }
      }}
      onMouseMove={handleResizeMove}
      onMouseUp={handleResizeEnd}
      onMouseLeave={() => {
        if (isResizing) {
          setIsResizing(false);
          setResizePreview(null);
        }
      }}
    >
      {hasConflict && (
        <div className="absolute top-1 right-1">
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </div>
      )}

      {variant === "month" && (
        <>
          <span className="font-medium">{startTime}</span>
          <span className="ml-1 opacity-75 truncate">{job.title || job.job_number}</span>
        </>
      )}

      {variant === "week" && (
        <>
          <div className="font-medium truncate">{job.title || job.job_number}</div>
          <div className="opacity-75 truncate">{customerName}</div>
          <div className="opacity-60 text-[10px]">
            {startTime} - {endTime}
          </div>
        </>
      )}

      {variant === "day" && (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{job.title || job.job_number}</div>
              <div className="text-sm opacity-75">{customerName}</div>
              {job.description && (
                <div className="text-sm opacity-60 mt-1 line-clamp-2">{job.description}</div>
              )}
            </div>
            <div className="text-right text-sm shrink-0">
              <div className="font-medium">{startTime}</div>
              <div className="opacity-60">{endTime}</div>
            </div>
          </div>
          {job.assignee && (
            <div className="mt-2 text-xs opacity-75">
              Assigned to: {job.assignee.first_name} {job.assignee.last_name}
            </div>
          )}
        </>
      )}

      {/* Resize handle for week/day views */}
      {(variant === "week" || variant === "day") && onResize && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
          onMouseDown={handleResizeStart}
        >
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-1 bg-current opacity-30 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );

  if (hasConflict && conflictMessage) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
          <TooltipContent>
            <p className="text-destructive">{conflictMessage}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
