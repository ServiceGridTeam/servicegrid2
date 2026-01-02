import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobPriorityBadgeProps {
  priority: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground hover:bg-muted/80" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700 hover:bg-blue-100/80 dark:bg-blue-950 dark:text-blue-300" },
  high: { label: "High", className: "bg-orange-100 text-orange-700 hover:bg-orange-100/80 dark:bg-orange-950 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 hover:bg-red-100/80 dark:bg-red-950 dark:text-red-300" },
};

export function JobPriorityBadge({ priority }: JobPriorityBadgeProps) {
  const config = priorityConfig[priority] || { label: priority, className: "" };

  return (
    <Badge variant="outline" className={cn("border-0", config.className)}>
      {config.label}
    </Badge>
  );
}
