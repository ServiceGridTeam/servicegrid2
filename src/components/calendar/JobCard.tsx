import { format, isSameDay, isToday } from "date-fns";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: JobWithCustomer;
  variant?: "month" | "week" | "day";
  onClick?: (job: JobWithCustomer) => void;
  className?: string;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
  in_progress: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
  completed: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
  cancelled: "bg-muted border-muted-foreground/20 text-muted-foreground",
};

export function JobCard({ job, variant = "month", onClick, className }: JobCardProps) {
  const statusColor = statusColors[job.status || "scheduled"] || statusColors.scheduled;
  const startTime = job.scheduled_start ? format(new Date(job.scheduled_start), "h:mm a") : "";
  const endTime = job.scheduled_end ? format(new Date(job.scheduled_end), "h:mm a") : "";
  const customerName = job.customer
    ? `${job.customer.first_name} ${job.customer.last_name}`
    : "";

  if (variant === "month") {
    return (
      <div
        className={cn(
          "text-xs p-1 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity",
          statusColor,
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(job);
        }}
      >
        <span className="font-medium">{startTime}</span>
        <span className="ml-1 opacity-75 truncate">{job.title || job.job_number}</span>
      </div>
    );
  }

  if (variant === "week") {
    return (
      <div
        className={cn(
          "text-xs p-1.5 rounded border cursor-pointer hover:opacity-80 transition-opacity overflow-hidden",
          statusColor,
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(job);
        }}
      >
        <div className="font-medium truncate">{job.title || job.job_number}</div>
        <div className="opacity-75 truncate">{customerName}</div>
        <div className="opacity-60 text-[10px]">
          {startTime} - {endTime}
        </div>
      </div>
    );
  }

  // Day variant - more detailed
  return (
    <div
      className={cn(
        "p-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity",
        statusColor,
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(job);
      }}
    >
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
    </div>
  );
}
