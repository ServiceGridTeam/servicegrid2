import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Calendar, Clock } from "lucide-react";
import { DraggableUnscheduledCard } from "./DraggableUnscheduledCard";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";

interface UnscheduledSidebarProps {
  jobs: JobWithCustomer[];
  onJobClick: (job: JobWithCustomer) => void;
  onScheduleJob: (job: JobWithCustomer) => void;
}

export function UnscheduledSidebar({
  jobs,
  onJobClick,
  onScheduleJob,
}: UnscheduledSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const unscheduledJobs = jobs.filter((job) => !job.scheduled_start);

  const { isOver, setNodeRef } = useDroppable({
    id: "unscheduled-sidebar",
    data: { type: "unscheduled-area" },
  });

  if (collapsed) {
    return (
      <div className="w-12 border-l bg-muted/30 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {unscheduledJobs.length > 0 && (
          <Badge variant="secondary" className="rounded-full">
            {unscheduledJobs.length}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 border-l bg-muted/30 flex flex-col transition-colors",
        isOver && "bg-primary/10"
      )}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Unscheduled</span>
          <Badge variant="secondary" className="rounded-full">
            {unscheduledJobs.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="h-6 w-6"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {unscheduledJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No unscheduled jobs
            </div>
          ) : (
            unscheduledJobs.map((job) => (
              <DraggableUnscheduledCard
                key={job.id}
                job={job}
                onClick={() => onJobClick(job)}
                onSchedule={() => onScheduleJob(job)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
