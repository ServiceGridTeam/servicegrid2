import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Calendar, Clock, Wand2 } from "lucide-react";
import { DraggableUnscheduledCard } from "./DraggableUnscheduledCard";
import { BulkAssignDialog } from "@/components/jobs/BulkAssignDialog";
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
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const unscheduledJobs = jobs.filter((job) => !job.scheduled_start);

  const { isOver, setNodeRef } = useDroppable({
    id: "unscheduled-sidebar",
    data: { type: "unscheduled-area" },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(unscheduledJobs.map(j => j.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds(prev => [...prev, jobId]);
    } else {
      setSelectedJobIds(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleBulkAssignComplete = () => {
    setSelectedJobIds([]);
  };

  const isAllSelected = unscheduledJobs.length > 0 && 
    unscheduledJobs.every(j => selectedJobIds.includes(j.id));

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
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
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
        
        {unscheduledJobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-unscheduled"
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all-unscheduled" className="text-xs text-muted-foreground">
                Select all
              </label>
            </div>
            
            {selectedJobIds.length > 0 && (
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs gap-1"
                onClick={() => setBulkAssignOpen(true)}
              >
                <Wand2 className="h-3 w-3" />
                Bulk Assign ({selectedJobIds.length})
              </Button>
            )}
          </div>
        )}
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
              <div key={job.id} className="flex items-start gap-2">
                <Checkbox
                  checked={selectedJobIds.includes(job.id)}
                  onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                  className="mt-3"
                />
                <div className="flex-1">
                  <DraggableUnscheduledCard
                    job={job}
                    onClick={() => onJobClick(job)}
                    onSchedule={() => onScheduleJob(job)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <BulkAssignDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        selectedJobIds={selectedJobIds}
        onComplete={handleBulkAssignComplete}
      />
    </div>
  );
}
