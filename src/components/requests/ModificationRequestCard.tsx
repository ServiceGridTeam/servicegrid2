import { formatDistanceToNow, format } from "date-fns";
import { Phone, Globe, Store, CalendarClock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobModificationRequest } from "@/hooks/useJobModificationRequests";

interface ModificationRequestCardProps {
  request: JobModificationRequest;
  onApprove: () => void;
  onReject: () => void;
  onViewJob?: () => void;
}

const sourceIcons = {
  phone: Phone,
  web: Globe,
  "walk-in": Store,
};

const sourceLabels = {
  phone: "Phone",
  web: "Web",
  "walk-in": "Walk-in",
};

const typeConfig = {
  reschedule: {
    label: "Reschedule",
    icon: CalendarClock,
    color: "bg-warning/10 text-warning border-warning/20",
  },
  cancel: {
    label: "Cancel",
    icon: XCircle,
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const statusColors = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  completed: "bg-primary/10 text-primary",
};

export function ModificationRequestCard({
  request,
  onApprove,
  onReject,
  onViewJob,
}: ModificationRequestCardProps) {
  const SourceIcon = sourceIcons[request.source] || Phone;
  const typeInfo = typeConfig[request.modification_type];
  const TypeIcon = typeInfo.icon;

  const customerName = request.job?.customer
    ? `${request.job.customer.first_name} ${request.job.customer.last_name}`
    : "Unknown Customer";

  const isPending = request.status === "pending";

  const formatSchedule = (start: string | null, end: string | null) => {
    if (!start) return "Not scheduled";
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const dateStr = format(startDate, "MMM d, yyyy");
    const timeStr = format(startDate, "h:mm a");
    const endTimeStr = endDate ? format(endDate, "h:mm a") : "";
    return endTimeStr ? `${dateStr} ${timeStr} - ${endTimeStr}` : `${dateStr} ${timeStr}`;
  };

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className={`gap-1 text-xs ${typeInfo.color}`}>
              <TypeIcon className="h-3 w-3" />
              {typeInfo.label}
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <SourceIcon className="h-3 w-3" />
              {sourceLabels[request.source]}
            </Badge>
            <Badge className={`text-xs ${statusColors[request.status]}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Job info */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-sm text-muted-foreground">
            {request.job?.job_number || "Unknown Job"}
          </span>
          <span className="text-muted-foreground">•</span>
          <span className="font-medium">{customerName}</span>
        </div>

        {/* Job title */}
        {request.job?.title && (
          <p className="text-sm text-muted-foreground mb-2">{request.job.title}</p>
        )}

        {/* Schedule info */}
        <div className="space-y-1 mb-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Current: </span>
            <span>{formatSchedule(request.job?.scheduled_start || null, request.job?.scheduled_end || null)}</span>
          </div>
          {request.modification_type === "reschedule" && (
            <div className="text-sm">
              <span className="text-muted-foreground">Requested: </span>
              <span className="text-warning">
                {request.requested_date || "No date specified"}
                {request.time_preference && ` (${request.time_preference})`}
              </span>
            </div>
          )}
        </div>

        {/* Reason */}
        {request.reason && (
          <p className="text-sm text-muted-foreground italic mb-3">
            "{request.reason}"
          </p>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button size="sm" onClick={onApprove}>
              {request.modification_type === "reschedule" ? "Approve & Reschedule" : "Approve Cancel"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onReject}
            >
              Reject
            </Button>
            {onViewJob && (
              <Button size="sm" variant="outline" onClick={onViewJob}>
                View Job
              </Button>
            )}
          </div>
        )}

        {!isPending && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            {onViewJob && (
              <Button size="sm" variant="outline" onClick={onViewJob}>
                View Job
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
