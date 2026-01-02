import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuoteStatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default", className: "bg-blue-500 hover:bg-blue-600" },
  viewed: { label: "Viewed", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600" },
  approved: { label: "Approved", variant: "default", className: "bg-green-500 hover:bg-green-600" },
  declined: { label: "Declined", variant: "destructive" },
  expired: { label: "Expired", variant: "outline", className: "line-through opacity-60" },
};

export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };

  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
