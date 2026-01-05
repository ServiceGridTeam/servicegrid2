import { useWorkerStatuses, type WorkerStatus } from "@/hooks/useWorkerStatuses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { MapPin, Clock, Briefcase, Users } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string }> = {
    available: { label: "Available", className: "bg-green-500/10 text-green-600 border-green-500/20" },
    on_job: { label: "On Job", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    traveling: { label: "Traveling", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    break: { label: "On Break", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
    offline: { label: "Offline", className: "bg-muted text-muted-foreground" },
  };

  const variant = variants[status] || variants.offline;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

function WorkerStatusRow({ worker }: { worker: WorkerStatus }) {
  const name = worker.profile
    ? `${worker.profile.first_name || ""} ${worker.profile.last_name || ""}`.trim() || "Unknown"
    : "Unknown";

  const initials = worker.profile
    ? `${worker.profile.first_name?.[0] || ""}${worker.profile.last_name?.[0] || ""}`
    : "?";

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={worker.profile?.avatar_url || undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          <StatusBadge status={worker.current_status} />
        </div>

        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          {worker.current_job && (
            <span className="flex items-center gap-1 truncate">
              <Briefcase className="h-3 w-3" />
              {worker.current_job.job_number}
              {worker.current_job.city && ` • ${worker.current_job.city}`}
            </span>
          )}

          {worker.last_location_at && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {formatDistanceToNow(new Date(worker.last_location_at), { addSuffix: true })}
            </span>
          )}

          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(worker.status_since), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WorkerStatusList() {
  const { data: workers, isLoading, error } = useWorkerStatuses();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load worker statuses
        </CardContent>
      </Card>
    );
  }

  if (!workers || workers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Status
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No worker status data available.
          <br />
          <span className="text-xs">Workers will appear here when they clock in.</span>
        </CardContent>
      </Card>
    );
  }

  // Group by status
  const onJob = workers.filter((w) => w.current_status === "on_job");
  const available = workers.filter((w) => w.current_status === "available");
  const other = workers.filter(
    (w) => !["on_job", "available"].includes(w.current_status)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Status
          <Badge variant="secondary" className="ml-auto">
            {workers.length} workers
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {onJob.map((worker) => (
          <WorkerStatusRow key={worker.id} worker={worker} />
        ))}
        {available.map((worker) => (
          <WorkerStatusRow key={worker.id} worker={worker} />
        ))}
        {other.map((worker) => (
          <WorkerStatusRow key={worker.id} worker={worker} />
        ))}
      </CardContent>
    </Card>
  );
}
