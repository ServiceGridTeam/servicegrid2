import { useState, useMemo, useCallback } from "react";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Route as RouteIcon,
  Users,
  MapPin,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoutePlanningMap } from "@/components/routes/RoutePlanningMap";
import { WorkerRouteSidebar } from "@/components/routes/WorkerRouteSidebar";
import { UnassignedJobsPanel } from "@/components/routes/UnassignedJobsPanel";
import { RouteSummaryBar } from "@/components/routes/RouteSummaryBar";
import { SmartAssignDialog } from "@/components/routes/SmartAssignDialog";
import { useDailyRoutePlansForDate } from "@/hooks/useDailyRoutePlans";
import { useJobs } from "@/hooks/useJobs";
import { useTeamMembers } from "@/hooks/useTeamManagement";
import { useBulkAutoAssign } from "@/hooks/useBulkAutoAssign";
import { toast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

export default function Routes() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<Job | null>(null);
  const [isSmartAssignOpen, setIsSmartAssignOpen] = useState(false);

  // Data fetching
  const { data: routePlans, isLoading: routesLoading } = useDailyRoutePlansForDate(selectedDate);
  const { data: allJobs, isLoading: jobsLoading } = useJobs();
  const { data: teamMembers, isLoading: teamLoading } = useTeamMembers();
  const bulkAutoAssign = useBulkAutoAssign();

  // Filter jobs for selected date
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  const jobsForDate = useMemo(() => {
    if (!allJobs) return [];
    return allJobs.filter((job) => {
      if (!job.scheduled_start) return false;
      const jobDate = format(new Date(job.scheduled_start), "yyyy-MM-dd");
      return jobDate === dateStr;
    });
  }, [allJobs, dateStr]);

  const assignedJobs = useMemo(() => {
    if (!jobsForDate || !routePlans) return [];
    const assignedIds = new Set(routePlans.flatMap((rp) => rp.job_ids || []));
    return jobsForDate.filter((job) => assignedIds.has(job.id) || job.assigned_to);
  }, [jobsForDate, routePlans]);

  const unassignedJobs = useMemo(() => {
    if (!allJobs) return [];
    // Jobs that are scheduled but not assigned, or unscheduled
    return allJobs.filter((job) => {
      // Include unscheduled jobs
      if (!job.scheduled_start) return true;
      // Include jobs scheduled for this date that aren't assigned
      const jobDate = format(new Date(job.scheduled_start), "yyyy-MM-dd");
      if (jobDate === dateStr && !job.assigned_to) return true;
      return false;
    }).filter((job) => job.status !== "completed" && job.status !== "cancelled");
  }, [allJobs, dateStr]);

  // Build worker routes data
  const workerRoutes = useMemo(() => {
    if (!routePlans || !teamMembers) return [];
    
    return routePlans.map((plan) => {
      const member = teamMembers.find((m) => m.id === plan.user_id);
      const planJobIds = plan.job_ids || [];
      const jobs = jobsForDate.filter((j) => planJobIds.includes(j.id));
      
      return {
        userId: plan.user_id,
        userName: member ? `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Unknown" : "Unknown",
        avatarUrl: member?.avatar_url,
        routePlan: plan,
        jobs,
      };
    });
  }, [routePlans, teamMembers, jobsForDate]);

  // Navigation
  const goToToday = () => setSelectedDate(new Date());
  const goToPrevDay = () => setSelectedDate((d) => subDays(d, 1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));

  // Smart assign handlers
  const handleSmartAssignJob = useCallback((job: Job) => {
    setSelectedJobForAssign(job);
    setIsSmartAssignOpen(true);
  }, []);

  const handleBulkAutoAssign = useCallback(async () => {
    if (unassignedJobs.length === 0) {
      toast({ title: "No unassigned jobs", description: "All jobs are already assigned." });
      return;
    }
    
    try {
      await bulkAutoAssign.mutateAsync({
        jobIds: unassignedJobs.slice(0, 20).map((j) => j.id), // Limit to 20 for performance
        dateRange: { start: dateStr, end: dateStr },
        balanceWorkload: true,
      });
      toast({ title: "Jobs assigned", description: "Jobs have been distributed to your team." });
    } catch (error) {
      toast({ 
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Could not assign jobs",
        variant: "destructive" 
      });
    }
  }, [unassignedJobs, bulkAutoAssign, dateStr]);

  const isLoading = routesLoading || jobsLoading || teamLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] -m-6">
      {/* Header */}
      <div className="shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <RouteIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Route Planning</h1>
            </div>
            
            {/* Date navigation */}
            <div className="flex items-center gap-2 ml-4">
              <Button variant="outline" size="icon" onClick={goToPrevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[180px] justify-start gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {format(selectedDate, "EEE, MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="icon" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={handleBulkAutoAssign}
              disabled={bulkAutoAssign.isPending || unassignedJobs.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {bulkAutoAssign.isPending ? "Assigning..." : "Smart Assign All"}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <RouteSummaryBar
        totalJobs={jobsForDate.length}
        assignedJobs={assignedJobs.length}
        unassignedJobs={unassignedJobs.length}
        totalWorkers={teamMembers?.length || 0}
        activeWorkers={workerRoutes.length}
        totalDistance={workerRoutes.reduce((sum, wr) => sum + (wr.routePlan.total_distance_meters || 0), 0)}
        totalDuration={workerRoutes.reduce((sum, wr) => sum + (wr.routePlan.total_duration_seconds || 0), 0)}
        isLoading={isLoading}
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar - Workers */}
        <WorkerRouteSidebar
          workerRoutes={workerRoutes}
          teamMembers={teamMembers || []}
          selectedWorkerId={selectedWorkerId}
          onSelectWorker={setSelectedWorkerId}
          isLoading={isLoading}
          selectedDate={selectedDate}
        />

        {/* Center - Map */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <RoutePlanningMap
              workerRoutes={workerRoutes}
              unassignedJobs={unassignedJobs}
              selectedWorkerId={selectedWorkerId}
              onSelectWorker={setSelectedWorkerId}
              onAssignJob={handleSmartAssignJob}
            />
          )}
        </div>

        {/* Right sidebar - Unassigned jobs */}
        <UnassignedJobsPanel
          jobs={unassignedJobs}
          onAssignJob={handleSmartAssignJob}
          isLoading={isLoading}
        />
      </div>

      {/* Smart assign dialog */}
      <SmartAssignDialog
        open={isSmartAssignOpen}
        onOpenChange={setIsSmartAssignOpen}
        job={selectedJobForAssign}
        teamMembers={teamMembers || []}
        workerRoutes={workerRoutes}
        selectedDate={selectedDate}
      />
    </div>
  );
}
