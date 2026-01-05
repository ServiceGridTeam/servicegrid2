import { useParams } from "react-router-dom";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { 
  MapPin, 
  Clock, 
  User, 
  CheckCircle2, 
  Truck, 
  Calendar,
  Timer,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicJobTracking } from "@/hooks/usePublicJobTracking";

export default function PublicJobTracking() {
  const { token } = useParams<{ token: string }>();
  const { data: job, isLoading, error, refetch } = usePublicJobTracking(token);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 p-4 md:p-8">
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[150px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="py-12">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground">
              This tracking link may be invalid or the job no longer exists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusConfig = (status: string | null) => {
    switch (status) {
      case "scheduled":
        return { label: "Scheduled", color: "bg-blue-500", icon: Calendar };
      case "in_progress":
        return { label: "In Progress", color: "bg-amber-500", icon: Truck };
      case "completed":
        return { label: "Completed", color: "bg-green-500", icon: CheckCircle2 };
      case "cancelled":
        return { label: "Cancelled", color: "bg-red-500", icon: AlertCircle };
      default:
        return { label: "Pending", color: "bg-gray-500", icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(job.status);
  const StatusIcon = statusConfig.icon;

  const scheduledTime = job.scheduled_start ? new Date(job.scheduled_start) : null;
  const estimatedArrival = job.estimated_arrival ? new Date(job.estimated_arrival) : scheduledTime;
  const actualArrival = job.actual_arrival ? new Date(job.actual_arrival) : null;

  const arrivalTime = actualArrival || estimatedArrival;
  const isArrived = job.status === "in_progress" || job.status === "completed";
  const isUpcoming = arrivalTime && isFuture(arrivalTime);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Service Tracking</h1>
          <p className="text-muted-foreground">Real-time updates for your appointment</p>
        </div>

        {/* Main Status Card */}
        <Card className="overflow-hidden">
          <div className={`${statusConfig.color} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <StatusIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm opacity-90">Status</p>
                  <p className="text-xl font-semibold">{statusConfig.label}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* ETA Section */}
            {arrivalTime && !actualArrival && job.status !== "completed" && (
              <div className="text-center py-4 border-b">
                <p className="text-sm text-muted-foreground mb-1">
                  {isUpcoming ? "Estimated Arrival" : "Arrival Time"}
                </p>
                <p className="text-3xl font-bold">
                  {format(arrivalTime, "h:mm a")}
                </p>
                {isUpcoming && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatDistanceToNow(arrivalTime, { addSuffix: true })}
                  </p>
                )}
              </div>
            )}

            {/* Actual Arrival */}
            {actualArrival && (
              <div className="text-center py-4 border-b">
                <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Arrived</span>
                </div>
                <p className="text-2xl font-bold">
                  {format(actualArrival, "h:mm a")}
                </p>
              </div>
            )}

            {/* Job Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Service Location</p>
                  <p className="font-medium">
                    {[job.address_line1, job.city, job.state].filter(Boolean).join(", ") || "Address on file"}
                  </p>
                </div>
              </div>

              {job.worker_name && (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your Technician</p>
                    <p className="font-medium">{job.worker_name}</p>
                  </div>
                </div>
              )}

              {scheduledTime && (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled For</p>
                    <p className="font-medium">
                      {format(scheduledTime, "EEEE, MMMM d")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(scheduledTime, "h:mm a")}
                      {job.scheduled_end && ` - ${format(new Date(job.scheduled_end), "h:mm a")}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Details Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{job.title}</p>
          </CardContent>
        </Card>

        {/* Live Updates Notice */}
        <div className="text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Live updates enabled</span>
          </div>
          <p className="mt-1">This page will automatically update with new information</p>
        </div>
      </div>
    </div>
  );
}
