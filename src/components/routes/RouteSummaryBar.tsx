import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, Navigation, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface RouteSummaryBarProps {
  totalJobs: number;
  assignedJobs: number;
  unassignedJobs: number;
  totalWorkers: number;
  activeWorkers: number;
  totalDistance: number;
  totalDuration: number;
  isLoading?: boolean;
}

export function RouteSummaryBar({
  totalJobs,
  assignedJobs,
  unassignedJobs,
  totalWorkers,
  activeWorkers,
  totalDistance,
  totalDuration,
  isLoading,
}: RouteSummaryBarProps) {
  const formatDistance = (meters: number) => {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center gap-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: MapPin,
      label: "Jobs",
      value: totalJobs,
      color: "text-blue-600",
    },
    {
      icon: CheckCircle2,
      label: "Assigned",
      value: assignedJobs,
      color: "text-green-600",
    },
    {
      icon: AlertCircle,
      label: "Unassigned",
      value: unassignedJobs,
      color: unassignedJobs > 0 ? "text-amber-600" : "text-muted-foreground",
    },
    {
      icon: Users,
      label: "Active Workers",
      value: `${activeWorkers}/${totalWorkers}`,
      color: "text-purple-600",
    },
    {
      icon: Navigation,
      label: "Total Distance",
      value: formatDistance(totalDistance),
      color: "text-teal-600",
    },
    {
      icon: Clock,
      label: "Drive Time",
      value: formatDuration(totalDuration),
      color: "text-orange-600",
    },
  ];

  return (
    <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
      <div className="flex items-center gap-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2">
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
            <span className="text-sm">
              <span className="font-medium">{stat.value}</span>
              <span className="text-muted-foreground ml-1">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
