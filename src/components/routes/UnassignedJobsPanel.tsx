import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Inbox, 
  Search, 
} from "lucide-react";
import { DraggableRouteJobCard } from "./DraggableRouteJobCard";
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
        <p className="text-xs text-muted-foreground">
          Drag jobs onto a team member to assign
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredJobs.map((job) => (
            <DraggableRouteJobCard
              key={job.id}
              job={job}
              onSmartAssign={() => onAssignJob(job)}
            />
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
