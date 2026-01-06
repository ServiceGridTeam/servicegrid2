import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, MapPin, User, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGeofenceAlerts, useAcknowledgeAlert, useDismissAlert, useGeofenceAlertsRealtime } from "@/hooks/useGeofenceAlerts";
import { useToast } from "@/hooks/use-toast";

export function GeofenceAlertList() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "acknowledged" | "all">("pending");
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: alerts, isLoading } = useGeofenceAlerts(statusFilter);
  const acknowledgeAlert = useAcknowledgeAlert();
  const dismissAlert = useDismissAlert();
  const { toast } = useToast();

  // Subscribe to realtime alerts
  useGeofenceAlertsRealtime((alert) => {
    toast({
      title: "New Geofence Alert",
      description: "A technician clocked in outside the geofence.",
      variant: "destructive",
    });
  });

  const handleAcknowledge = async () => {
    if (!selectedAlertId) return;

    try {
      await acknowledgeAlert.mutateAsync({
        alertId: selectedAlertId,
        notes: resolutionNotes || undefined,
      });
      toast({
        title: "Alert acknowledged",
        description: "The geofence alert has been acknowledged.",
      });
      setAcknowledgeDialogOpen(false);
      setSelectedAlertId(null);
      setResolutionNotes("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to acknowledge alert.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert.mutateAsync(alertId);
      toast({
        title: "Alert dismissed",
        description: "The alert has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to dismiss alert.",
        variant: "destructive",
      });
    }
  };

  const openAcknowledgeDialog = (alertId: string) => {
    setSelectedAlertId(alertId);
    setAcknowledgeDialogOpen(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "warning";
      default:
        return "secondary";
    }
  };

  const metersToFeet = (meters: number) => Math.round(meters * 3.28084);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Geofence Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Geofence Alerts
          </CardTitle>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {alerts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">No {statusFilter === "all" ? "" : statusFilter} alerts</p>
              <p className="text-sm mt-1">All geofence alerts have been handled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts?.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={alert.user?.avatar_url || undefined} />
                    <AvatarFallback>
                      {alert.user?.first_name?.[0] || "?"}
                      {alert.user?.last_name?.[0] || ""}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {alert.user?.first_name} {alert.user?.last_name}
                      </span>
                      <Badge variant={getSeverityColor(alert.severity) as "destructive" | "secondary"}>
                        {alert.severity}
                      </Badge>
                      {alert.status === "acknowledged" && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Acknowledged
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {metersToFeet(alert.distance_meters)} ft away
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {alert.job && (
                      <p className="text-sm mt-1">
                        Job: <span className="font-medium">{alert.job.job_number}</span>
                        {alert.job.title && ` - ${alert.job.title}`}
                      </p>
                    )}

                    {alert.resolution_notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        "{alert.resolution_notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => openAcknowledgeDialog(alert.id)}
                        disabled={acknowledgeAlert.isPending}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(alert.id)}
                      disabled={dismissAlert.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Alert</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Resolution Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this alert..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcknowledgeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAcknowledge}
              disabled={acknowledgeAlert.isPending}
            >
              {acknowledgeAlert.isPending ? "Acknowledging..." : "Acknowledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
