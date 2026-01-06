import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalStatusBadgeProps {
  hasPortalAccess: boolean;
  pendingInvite: boolean;
  className?: string;
}

export function PortalStatusBadge({
  hasPortalAccess,
  pendingInvite,
  className,
}: PortalStatusBadgeProps) {
  if (hasPortalAccess) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-green-500/10 text-green-600 border-green-500/20",
          className
        )}
      >
        <CheckCircle className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  }

  if (pendingInvite) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-amber-500/10 text-amber-600 border-amber-500/20",
          className
        )}
      >
        <Clock className="mr-1 h-3 w-3" />
        Invited
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-muted-foreground", className)}
    >
      <UserX className="mr-1 h-3 w-3" />
      Not Invited
    </Badge>
  );
}
