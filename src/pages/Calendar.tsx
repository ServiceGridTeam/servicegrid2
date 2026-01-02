import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { useJobs, type JobWithCustomer } from "@/hooks/useJobs";
import { JobDetailSheet, JobFormDialog, JobStatusBadge } from "@/components/jobs";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Fetch jobs for the current month
  const { data: jobs = [] } = useJobs({
    dateFrom: startOfMonth(currentDate),
    dateTo: endOfMonth(currentDate),
  });

  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const getJobsForDay = (day: number) => {
    return jobs.filter((job) => {
      if (!job.scheduled_start) return false;
      const jobDate = new Date(job.scheduled_start);
      return (
        jobDate.getDate() === day &&
        jobDate.getMonth() === month &&
        jobDate.getFullYear() === year
      );
    });
  };

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    setFormDialogOpen(true);
  };

  const handleJobClick = (job: JobWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedJob(job);
    setDetailSheetOpen(true);
  };

  const handleEditJob = (job: JobWithCustomer) => {
    setSelectedJob(job);
    setDetailSheetOpen(false);
    setFormDialogOpen(true);
  };

  const handleScheduleJob = () => {
    setSelectedDate(new Date());
    setFormDialogOpen(true);
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
        className={`h-28 border-t p-1.5 transition-colors hover:bg-muted/50 cursor-pointer overflow-hidden ${
          isToday(day) ? "bg-primary/5" : ""
        }`}
        onClick={() => handleDayClick(day)}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
              isToday(day)
                ? "bg-primary text-primary-foreground font-medium"
                : ""
            }`}
          >
            {day}
          </span>
          {dayJobs.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{dayJobs.length - 2} more
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {dayJobs.slice(0, 2).map((job) => (
            <div
              key={job.id}
              className="text-xs p-1 rounded bg-primary/10 hover:bg-primary/20 truncate cursor-pointer"
              onClick={(e) => handleJobClick(job, e)}
            >
              <span className="font-medium">
                {job.scheduled_start && format(new Date(job.scheduled_start), "h:mm a")}
              </span>
              <span className="ml-1 text-muted-foreground truncate">
                {job.title || job.job_number}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const scheduledJobsCount = jobs.filter((j) => j.status === "scheduled").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your job schedule
          </p>
        </div>
        <Button onClick={handleScheduleJob}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Job
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">
            {months[month]} {year}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">{days}</div>
        </CardContent>
      </Card>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <CalendarIcon className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No jobs scheduled</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your scheduled jobs will appear on the calendar
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Upcoming Jobs ({scheduledJobsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs
                .filter((job) => job.status === "scheduled")
                .slice(0, 5)
                .map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setSelectedJob(job);
                      setDetailSheetOpen(true);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.job_number}</span>
                        <JobStatusBadge status={job.status || "scheduled"} />
                      </div>
                      {job.title && (
                        <p className="text-sm text-muted-foreground truncate">
                          {job.title}
                        </p>
                      )}
                      {job.customer && (
                        <p className="text-sm text-muted-foreground">
                          {job.customer.first_name} {job.customer.last_name}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      {job.scheduled_start && (
                        <>
                          <p className="font-medium">
                            {format(new Date(job.scheduled_start), "MMM d")}
                          </p>
                          <p className="text-muted-foreground">
                            {format(new Date(job.scheduled_start), "h:mm a")}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <JobDetailSheet
        job={selectedJob}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={handleEditJob}
      />

      <JobFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        job={selectedJob && !detailSheetOpen ? selectedJob : undefined}
        defaultDate={selectedDate}
        onSuccess={() => setSelectedJob(null)}
      />
    </div>
  );
}
