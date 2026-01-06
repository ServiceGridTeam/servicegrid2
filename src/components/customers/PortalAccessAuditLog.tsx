import { usePortalAccessAudit, PortalAuditEvent } from "@/hooks/usePortalAccessAudit";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  LogIn,
  UserCheck,
  UserX,
  Bell,
  Clock,
  Globe,
  Monitor,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PortalAccessAuditLogProps {
  customerId: string;
}

const EVENT_CONFIG: Record<
  string,
  { icon: typeof LogIn; label: string; color: string }
> = {
  invite_sent: {
    icon: Mail,
    label: "Invite Sent",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  login: {
    icon: LogIn,
    label: "Login",
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  first_login: {
    icon: UserCheck,
    label: "First Login",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  access_revoked: {
    icon: UserX,
    label: "Access Revoked",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  reminder_sent: {
    icon: Bell,
    label: "Reminder Sent",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
};

function getEventConfig(eventType: string) {
  return (
    EVENT_CONFIG[eventType] || {
      icon: Clock,
      label: eventType.replace(/_/g, " "),
      color: "bg-muted text-muted-foreground",
    }
  );
}

function AuditEventCard({ event }: { event: PortalAuditEvent }) {
  const config = getEventConfig(event.event_type);
  const Icon = config.icon;

  const getEventDescription = () => {
    const details = event.event_details;
    switch (event.event_type) {
      case "invite_sent":
        return `Invitation sent to ${details.email || "customer"}`;
      case "login":
        return `Logged in via ${details.method || "portal"}`;
      case "first_login":
        return `First portal login via ${details.method || "magic link"}`;
      case "access_revoked":
        return event.performer_name
          ? `Access revoked by ${event.performer_name}`
          : "Portal access revoked";
      case "reminder_sent":
        return `Reminder #${details.reminder_number || 1} sent`;
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-0">
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground mt-1">{getEventDescription()}</p>
        {(event.ip_address || event.user_agent) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {event.ip_address && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {event.ip_address}
              </span>
            )}
            {event.user_agent && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <Monitor className="h-3 w-3" />
                {event.user_agent.split(" ")[0]}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(event.created_at), "PPp")}
        </p>
      </div>
    </div>
  );
}

export function PortalAccessAuditLog({ customerId }: PortalAccessAuditLogProps) {
  const { data: events, isLoading, error } = usePortalAccessAudit(customerId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Failed to load audit log
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No portal access events recorded yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-0">
        {events.map((event) => (
          <AuditEventCard key={event.id} event={event} />
        ))}
      </div>
    </ScrollArea>
  );
}
