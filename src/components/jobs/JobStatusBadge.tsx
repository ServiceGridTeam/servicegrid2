import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  scheduled: { label: "Scheduled", variant: "default", className: "bg-blue-500 hover:bg-blue-500/80" },
  in_progress: { label: "In Progress", variant: "default", className: "bg-yellow-500 hover:bg-yellow-500/80 text-yellow-950" },
  completed: { label: "Completed", variant: "default", className: "bg-green-500 hover:bg-green-500/80" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };

  return (
    <Badge variant={config.variant} className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
