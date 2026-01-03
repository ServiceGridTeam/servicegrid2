import { useState, useEffect, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useJobs, useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { JobDetailSheet, JobFormDialog } from "@/components/jobs";
import { WeekCalendar, DayCalendar, JobCard, UnscheduledSidebar } from "@/components/calendar";
import { TeamMemberFilter } from "@/components/calendar/TeamMemberFilter";
import { CalendarExport } from "@/components/calendar/CalendarExport";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek, setHours, setMinutes, addHours } from "date-fns";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ViewType = "month" | "week" | "day";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("month");
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [draggingJob, setDraggingJob] = useState<JobWithCustomer | null>(null);
  
  const { toast } = useToast();
  const updateJob = useUpdateJob();

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Date range based on view
  const getDateRange = () => {
    switch (view) {
      case "week":
        return { from: startOfWeek(currentDate), to: endOfWeek(currentDate) };
      case "day":
        return { from: currentDate, to: currentDate };
      default:
        return { from: startOfMonth(currentDate), to: endOfMonth(currentDate) };
    }
  };

  const { from, to } = getDateRange();
  const { data: allJobs = [] } = useJobs();

  // Filter jobs by date range and team member selection
  const jobs = allJobs.filter((job) => {
    if (job.scheduled_start) {
      const start = new Date(job.scheduled_start);
      if (start < from || start > to) return false;
    }
    if (selectedTeamMembers.length > 0 && job.assigned_to) {
      if (!selectedTeamMembers.includes(job.assigned_to)) return false;
    }
    return true;
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "t":
        case "T":
          e.preventDefault();
          setCurrentDate(new Date());
          break;
        case "d":
        case "D":
          e.preventDefault();
          setView("day");
          break;
        case "w":
        case "W":
          e.preventDefault();
          setView("week");
          break;
        case "m":
        case "M":
          e.preventDefault();
          setView("month");
          break;
        case "n":
        case "N":
          e.preventDefault();
          handleScheduleJob();
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigate("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate("next");
          break;
        case "Escape":
          setDetailSheetOpen(false);
          setFormDialogOpen(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentDate, view]);

  const navigate = (direction: "prev" | "next") => {
    const add = direction === "next";
    switch (view) {
      case "week":
        setCurrentDate(add ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(add ? addDays(currentDate, 1) : subDays(currentDate, 1));
        break;
      default:
        setCurrentDate(add ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    }
  };

  const getHeaderTitle = () => {
    switch (view) {
      case "week":
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy");
      default:
        return format(currentDate, "MMMM yyyy");
    }
  };

  const handleJobClick = (job: JobWithCustomer) => {
    setSelectedJob(job);
    setDetailSheetOpen(true);
  };

  const handleTimeSlotClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedJob(null);
    setFormDialogOpen(true);
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(clickedDate);
    setSelectedJob(null);
    setFormDialogOpen(true);
  };

  const handleEditJob = (job: JobWithCustomer) => {
    setSelectedJob(job);
    setDetailSheetOpen(false);
    setFormDialogOpen(true);
  };

  const handleScheduleJob = (job?: JobWithCustomer) => {
    if (job) {
      setSelectedJob(job);
    } else {
      setSelectedJob(null);
    }
    setSelectedDate(new Date());
    setFormDialogOpen(true);
  };

  const handleJobResize = useCallback(async (job: JobWithCustomer, newEndTime: Date) => {
    try {
      await updateJob.mutateAsync({
        id: job.id,
        scheduled_end: newEndTime.toISOString(),
      });
      toast({
        title: "Duration updated",
        description: `Job duration changed to end at ${format(newEndTime, "h:mm a")}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job duration.",
        variant: "destructive",
      });
    }
  }, [updateJob, toast]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const job = active.data.current?.job as JobWithCustomer | undefined;
    if (job) {
      setDraggingJob(job);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingJob(null);

    if (!over) return;

    const dragData = active.data.current;
    const dropData = over.data.current;

    if (!dragData?.job || !dropData) return;

    const job = dragData.job as JobWithCustomer;

    // Dropping on a time slot
    if (dropData.type === "timeslot") {
      const { day, hour, minute = 0 } = dropData;
      const newStart = setMinutes(setHours(day, hour), minute);
      
      // Calculate duration from existing job or default to 1 hour
      let duration = 60; // Default 1 hour in minutes
      if (job.scheduled_start && job.scheduled_end) {
        const existingStart = new Date(job.scheduled_start);
        const existingEnd = new Date(job.scheduled_end);
        duration = (existingEnd.getTime() - existingStart.getTime()) / (1000 * 60);
      }
      
      const newEnd = addHours(newStart, duration / 60);

      try {
        await updateJob.mutateAsync({
          id: job.id,
          scheduled_start: newStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
        });
        toast({
          title: "Job scheduled",
          description: `${job.title || job.job_number} scheduled for ${format(newStart, "MMM d 'at' h:mm a")}.`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to schedule job.",
          variant: "destructive",
        });
      }
    }

    // Dropping back to unscheduled area
    if (dropData.type === "unscheduled-area" && job.scheduled_start) {
      try {
        await updateJob.mutateAsync({
          id: job.id,
          scheduled_start: null,
          scheduled_end: null,
        });
        toast({
          title: "Job unscheduled",
          description: `${job.title || job.job_number} moved to unscheduled.`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to unschedule job.",
          variant: "destructive",
        });
      }
    }
  };

  // Month view rendering
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const isToday = (day: number) =>
      day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const getJobsForDay = (day: number) => {
      return jobs.filter((job) => {
        if (!job.scheduled_start) return false;
        const jobDate = new Date(job.scheduled_start);
        return jobDate.getDate() === day && jobDate.getMonth() === month && jobDate.getFullYear() === year;
      });
    };

    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-28 bg-muted/30" />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayJobs = getJobsForDay(day);
      days.push(
        <div
          key={day}
          className={`h-28 border-t p-1.5 transition-colors hover:bg-muted/50 cursor-pointer overflow-hidden ${isToday(day) ? "bg-primary/5" : ""}`}
          onClick={() => handleDayClick(day)}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${isToday(day) ? "bg-primary text-primary-foreground font-medium" : ""}`}>
              {day}
            </span>
            {dayJobs.length > 2 && <span className="text-xs text-muted-foreground">+{dayJobs.length - 2} more</span>}
          </div>
          <div className="space-y-0.5">
            {dayJobs.slice(0, 2).map((job) => (
              <JobCard key={job.id} job={job} variant="month" onClick={handleJobClick} />
            ))}
          </div>
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-2 text-center text-sm font-medium text-muted-foreground">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">{days}</div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-8rem)]">
        <div className="flex-1 flex flex-col space-y-4 animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground">View and manage your job schedule</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TeamMemberFilter
                selectedIds={selectedTeamMembers}
                onChange={setSelectedTeamMembers}
              />
              <CalendarExport jobs={jobs} currentDate={currentDate} view={view} />
              <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewType)}>
                <ToggleGroupItem value="day" size="sm">Day</ToggleGroupItem>
                <ToggleGroupItem value="week" size="sm">Week</ToggleGroupItem>
                <ToggleGroupItem value="month" size="sm">Month</ToggleGroupItem>
              </ToggleGroup>
              <Button onClick={() => handleScheduleJob()}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Job
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <Card className="shrink-0">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-lg">{getHeaderTitle()}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => navigate("prev")}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => navigate("next")}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Calendar Views */}
          <div className="flex-1 overflow-hidden">
            {view === "month" && renderMonthView()}
            {view === "week" && (
              <Card className="h-full">
                <WeekCalendar
                  currentDate={currentDate}
                  jobs={jobs}
                  allJobs={allJobs}
                  onJobClick={handleJobClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  onJobResize={handleJobResize}
                />
              </Card>
            )}
            {view === "day" && (
              <Card className="h-full">
                <DayCalendar
                  currentDate={currentDate}
                  jobs={jobs}
                  allJobs={allJobs}
                  onJobClick={handleJobClick}
                  onTimeSlotClick={handleTimeSlotClick}
                  onJobResize={handleJobResize}
                />
              </Card>
            )}
          </div>
        </div>

        {/* Unscheduled Sidebar */}
        <UnscheduledSidebar jobs={allJobs} onJobClick={handleJobClick} onScheduleJob={handleScheduleJob} />

        <JobDetailSheet job={selectedJob} open={detailSheetOpen} onOpenChange={setDetailSheetOpen} onEdit={handleEditJob} />
        <JobFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} job={selectedJob && !detailSheetOpen ? selectedJob : undefined} defaultDate={selectedDate} onSuccess={() => setSelectedJob(null)} />
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggingJob && (
          <div className="opacity-80 pointer-events-none">
            <JobCard job={draggingJob} variant="week" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
