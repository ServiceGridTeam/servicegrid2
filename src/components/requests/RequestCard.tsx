import { formatDistanceToNow } from "date-fns";
import { Phone, Globe, Store, MapPin, User, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobRequest } from "@/hooks/useJobRequests";

interface RequestCardProps {
  request: JobRequest;
  onApprove: () => void;
  onScheduleApprove: () => void;
  onViewDetails: () => void;
  onReject: () => void;
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

const urgencyColors = {
  routine: "bg-success/10 text-success border-success/20",
  soon: "bg-warning/10 text-warning border-warning/20",
  urgent: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  emergency: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColors = {
  pending: "bg-muted text-muted-foreground",
  reviewing: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  converted: "bg-primary/10 text-primary",
};

export function RequestCard({
  request,
  onApprove,
  onScheduleApprove,
  onViewDetails,
  onReject,
}: RequestCardProps) {
  const SourceIcon = sourceIcons[request.source] || Phone;
  const displayName =
    request.customer_name ||
    (request.customer
      ? `${request.customer.first_name} ${request.customer.last_name}`
      : "Unknown");

  const addressString = request.address
    ? [
        request.address.line1,
        request.address.city,
        request.address.state,
        request.address.zip,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const isPending = request.status === "pending" || request.status === "reviewing";

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <SourceIcon className="h-3 w-3" />
              {sourceLabels[request.source]}
            </Badge>
            <Badge className={`text-xs ${urgencyColors[request.urgency]}`}>
              {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
            </Badge>
            <Badge className={`text-xs ${statusColors[request.status]}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            </span>
            <span className="font-mono">{request.id.slice(0, 8)}</span>
          </div>
        </div>

        {/* Customer info */}
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{displayName}</span>
          {request.customer_id && (
            <Badge variant="secondary" className="text-xs">
              Existing
            </Badge>
          )}
          {request.customer_phone && (
            <span className="text-sm text-muted-foreground">
              {request.customer_phone}
            </span>
          )}
        </div>

        {/* Service info */}
        <div className="mb-2">
          {request.service_type && (
            <span className="font-medium text-sm">{request.service_type}</span>
          )}
          {request.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {request.description}
            </p>
          )}
        </div>

        {/* Address */}
        {addressString && (
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{addressString}</span>
          </div>
        )}

        {/* Preferred date/time */}
        {(request.preferred_date || request.preferred_time) && (
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              Preferred: {request.preferred_date || ""}{" "}
              {request.preferred_time || ""}
            </span>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button size="sm" onClick={onApprove}>
              Approve
            </Button>
            <Button size="sm" variant="secondary" onClick={onScheduleApprove}>
              Schedule & Approve
            </Button>
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onReject}
            >
              Reject
            </Button>
          </div>
        )}

        {!isPending && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              View Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
