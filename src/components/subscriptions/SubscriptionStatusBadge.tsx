import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SubscriptionStatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  pending_payment: { label: "Pending Payment", className: "bg-foreground/5 text-foreground/70 border-foreground/10" },
  active: { label: "Active", className: "bg-foreground/15 text-foreground border-foreground/20" },
  paused: { label: "Paused", className: "bg-warning/20 text-warning-foreground border-warning/30" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expired", className: "bg-muted text-muted-foreground/70 border-border" },
};

export function SubscriptionStatusBadge({ status, className }: SubscriptionStatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        <Badge 
          variant="outline" 
          className={cn("border", config.className, className)}
        >
          {config.label}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}
