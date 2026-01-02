import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100/80 dark:bg-blue-900 dark:text-blue-300",
  },
  paid: {
    label: "Paid",
    className: "bg-green-100 text-green-700 hover:bg-green-100/80 dark:bg-green-900 dark:text-green-300",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 hover:bg-red-100/80 dark:bg-red-900 dark:text-red-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
};

interface InvoiceStatusBadgeProps {
  status: string;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant="outline" className={cn("border-0", config.className)}>
      {config.label}
    </Badge>
  );
}
