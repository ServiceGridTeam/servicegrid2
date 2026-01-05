import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AvailabilityStatus = "available" | "unavailable" | "time-off";

interface AvailabilityStatusBadgeProps {
  status: AvailabilityStatus;
  className?: string;
}

export function AvailabilityStatusBadge({ status, className }: AvailabilityStatusBadgeProps) {
  const config = {
    available: {
      label: "Available",
      variant: "default" as const,
      className: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20",
    },
    unavailable: {
      label: "Unavailable",
      variant: "secondary" as const,
      className: "bg-muted text-muted-foreground",
    },
    "time-off": {
      label: "Time Off",
      variant: "outline" as const,
      className: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
    },
  };

  const { label, variant, className: statusClassName } = config[status];

  return (
    <Badge variant={variant} className={cn(statusClassName, className)}>
      {label}
    </Badge>
  );
}
