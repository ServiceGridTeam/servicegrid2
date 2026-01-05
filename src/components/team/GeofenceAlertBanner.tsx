import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useGeofenceAlerts, 
  usePendingAlertsCount, 
  useAcknowledgeAlert,
  useGeofenceAlertsRealtime 
} from "@/hooks/useGeofenceAlerts";
import { useToast } from "@/hooks/use-toast";
import { MapPin, AlertTriangle, Check, Clock, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function GeofenceAlertBanner() {
  const { toast } = useToast();
  const { data: alerts = [], isLoading } = useGeofenceAlerts("pending");
  const { data: pendingCount = 0 } = usePendingAlertsCount();
  const acknowledgeAlert = useAcknowledgeAlert();
  const [open, setOpen] = useState(false);

  // Subscribe to realtime alerts
  useGeofenceAlertsRealtime((newAlert) => {
    toast({
      title: "New Geofence Alert",
      description: getAlertMessage(newAlert.alert_type, newAlert.distance_meters),
    });
  });

  const getAlertMessage = (alertType: string, distanceMeters: number) => {
    const distanceFeet = Math.round(distanceMeters * 3.28084);
    switch (alertType) {
      case "clock_in_outside":
        return `Clocked in ${distanceFeet} ft from job site`;
      case "clock_out_outside":
        return `Clocked out ${distanceFeet} ft from job site`;
      case "override_requested":
        return `Override requested ${distanceFeet} ft from job site`;
      default:
        return `Geofence violation: ${distanceFeet} ft away`;
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case "clock_in_outside":
        return <Clock className="h-4 w-4" />;
      case "clock_out_outside":
        return <XCircle className="h-4 w-4" />;
      case "override_requested":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
        return "bg-destructive text-destructive-foreground";
      case "warning":
        return "bg-yellow-500 text-white";
      case "info":
        return "bg-blue-500 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert.mutateAsync({ alertId });
      toast({
        title: "Alert acknowledged",
        description: "The geofence alert has been marked as acknowledged.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert.",
        variant: "destructive",
      });
    }
  };

  if (pendingCount === 0) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <MapPin className="h-4 w-4" />
          <span className="hidden sm:inline">Geofence Alerts</span>
          <Badge 
            variant="destructive" 
            className="ml-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
          >
            {pendingCount}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Pending Alerts</span>
          <Badge variant="outline">{pendingCount}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No pending alerts
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {alerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="p-3 border-b last:border-0">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={alert.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {alert.user?.first_name?.[0]}
                      {alert.user?.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {alert.user?.first_name} {alert.user?.last_name}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs h-5", getSeverityColor(alert.severity))}
                      >
                        {getAlertIcon(alert.alert_type)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.job?.job_number}: {alert.job?.title}
                    </p>
                    <p className="text-xs font-medium mt-1">
                      {getAlertMessage(alert.alert_type, alert.distance_meters)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledgeAlert.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
