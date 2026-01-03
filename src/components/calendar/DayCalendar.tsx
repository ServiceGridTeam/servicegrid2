import { useMemo } from "react";
import {
  format,
  isSameDay,
  isToday,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { JobCard } from "./JobCard";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DayCalendarProps {
  currentDate: Date;
  jobs: JobWithCustomer[];
  onJobClick: (job: JobWithCustomer) => void;
  onTimeSlotClick: (date: Date) => void;
}

const HOUR_HEIGHT = 80; // pixels per hour (larger for day view)
const START_HOUR = 6; // 6 AM
const END_HOUR = 20; // 8 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function DayCalendar({
  currentDate,
  jobs,
  onJobClick,
  onTimeSlotClick,
}: DayCalendarProps) {
  const dayJobs = jobs.filter((job) => {
    if (!job.scheduled_start) return false;
    return isSameDay(new Date(job.scheduled_start), currentDate);
  });

  const getJobPosition = (job: JobWithCustomer) => {
    if (!job.scheduled_start) return { top: 0, height: 80 };

    const start = new Date(job.scheduled_start);
    const end = job.scheduled_end ? new Date(job.scheduled_end) : start;
    const dayStart = setMinutes(setHours(currentDate, START_HOUR), 0);

    const topMinutes = differenceInMinutes(start, dayStart);
    const duration = differenceInMinutes(end, start) || 60;

    return {
      top: (topMinutes / 60) * HOUR_HEIGHT,
      height: Math.max((duration / 60) * HOUR_HEIGHT, 40),
    };
  };

  const handleTimeSlotClick = (hour: number) => {
    const date = setMinutes(setHours(currentDate, hour), 0);
    onTimeSlotClick(date);
  };

  // Current time indicator
  const now = new Date();
  const currentTimeTop = useMemo(() => {
    if (!isToday(currentDate)) return -1;
    const dayStart = setMinutes(setHours(currentDate, START_HOUR), 0);
    const minutes = differenceInMinutes(now, dayStart);
    return (minutes / 60) * HOUR_HEIGHT;
  }, [currentDate]);

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "text-center",
              isToday(currentDate) && "text-primary"
            )}
          >
            <div className="text-sm text-muted-foreground">
              {format(currentDate, "EEEE")}
            </div>
            <div
              className={cn(
                "text-3xl font-bold",
                isToday(currentDate) &&
                  "bg-primary text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center"
              )}
            >
              {format(currentDate, "d")}
            </div>
          </div>
          <div className="text-muted-foreground">
            {format(currentDate, "MMMM yyyy")}
          </div>
        </div>
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-20 shrink-0 border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[80px] border-b text-sm text-muted-foreground pr-3 text-right relative"
              >
                <span className="absolute -top-2.5 right-3">
                  {format(setHours(new Date(), hour), "h:mm a")}
                </span>
              </div>
            ))}
          </div>

          {/* Main content area */}
          <div className="flex-1 relative">
            {/* Hour slots */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[80px] border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => handleTimeSlotClick(hour)}
              >
                {/* Half hour line */}
                <div className="h-1/2 border-b border-dashed border-muted" />
              </div>
            ))}

            {/* Current time indicator */}
            {currentTimeTop > 0 && currentTimeTop < HOURS.length * HOUR_HEIGHT && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <div className="flex-1 h-0.5 bg-destructive" />
                </div>
              </div>
            )}

            {/* Jobs */}
            <div className="absolute inset-0 p-1 pointer-events-none">
              {dayJobs.map((job) => {
                const { top, height } = getJobPosition(job);
                return (
                  <div
                    key={job.id}
                    className="absolute left-1 right-1 pointer-events-auto"
                    style={{ top, height }}
                  >
                    <JobCard
                      job={job}
                      variant="day"
                      onClick={onJobClick}
                      className="h-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
