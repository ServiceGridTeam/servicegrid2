import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Inbox, 
  Search, 
  MapPin, 
  Clock, 
  AlertCircle,
  Sparkles,
  GripVertical
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface UnassignedJobsPanelProps {
  jobs: Job[];
  onAssignJob: (job: Job) => void;
  isLoading: boolean;
}

export function UnassignedJobsPanel({
  jobs,
  onAssignJob,
  isLoading,
}: UnassignedJobsPanelProps) {
  const [search, setSearch] = useState("");

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const lower = search.toLowerCase();
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(lower) ||
        job.address_line1?.toLowerCase().includes(lower) ||
        job.city?.toLowerCase().includes(lower)
    );
  }, [jobs, search]);

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgent":
        return "text-destructive bg-destructive/10";
      case "high":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 border-l bg-background shrink-0 p-4 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-full" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-80 border-l bg-background shrink-0 flex flex-col">
      <div className="p-4 border-b shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Unassigned</h2>
          <Badge variant="secondary" className="ml-auto">
            {jobs.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-start gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm leading-tight truncate">
                      {job.title}
                    </h4>
                    {(job.priority === "urgent" || job.priority === "high") && (
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 text-[10px] px-1.5 ${getPriorityColor(job.priority)}`}
                      >
                        {job.priority}
                      </Badge>
                    )}
                  </div>

                  {(job.address_line1 || job.city) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {[job.address_line1, job.city].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {job.estimated_duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.estimated_duration_minutes}m
                      </span>
                    )}
                    {job.scheduled_start && (
                      <span>
                        {format(new Date(job.scheduled_start), "MMM d")}
                      </span>
                    )}
                    {!job.latitude && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        No location
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full mt-3 h-8 gap-1.5"
                    onClick={() => onAssignJob(job)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Smart Assign
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 && jobs.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No matching jobs</p>
            </div>
          )}

          {jobs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs mt-1">No unassigned jobs</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
