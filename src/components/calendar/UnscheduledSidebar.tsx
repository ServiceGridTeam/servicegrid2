import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft, Calendar, Clock } from "lucide-react";
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
    <div className="w-72 border-l bg-muted/30 flex flex-col">
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
              <UnscheduledJobCard
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

interface UnscheduledJobCardProps {
  job: JobWithCustomer;
  onClick: () => void;
  onSchedule: () => void;
}

function UnscheduledJobCard({ job, onClick, onSchedule }: UnscheduledJobCardProps) {
  const customerName = job.customer
    ? `${job.customer.first_name} ${job.customer.last_name}`
    : "";

  const priorityColors: Record<string, string> = {
    high: "border-l-destructive",
    normal: "border-l-primary",
    low: "border-l-muted-foreground",
  };

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors border-l-4",
        priorityColors[job.priority || "normal"]
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {job.title || job.job_number}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {customerName}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule();
            }}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
