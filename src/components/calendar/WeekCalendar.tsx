import { useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";
import { DraggableJobCard } from "./DraggableJobCard";
import { DroppableTimeSlot } from "./DroppableTimeSlot";
import type { JobWithCustomer } from "@/hooks/useJobs";
import { findConflicts } from "@/hooks/useCheckConflicts";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WeekCalendarProps {
  currentDate: Date;
  jobs: JobWithCustomer[];
  allJobs: JobWithCustomer[];
  onJobClick: (job: JobWithCustomer) => void;
  onTimeSlotClick: (date: Date) => void;
  onJobResize?: (job: JobWithCustomer, newEndTime: Date) => void;
}

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 6; // 6 AM
const END_HOUR = 20; // 8 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export function WeekCalendar({
  currentDate,
  jobs,
  allJobs,
  onJobClick,
  onTimeSlotClick,
  onJobResize,
}: WeekCalendarProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getJobsForDay = (day: Date) => {
    return jobs.filter((job) => {
      if (!job.scheduled_start) return false;
      return isSameDay(new Date(job.scheduled_start), day);
    });
  };

  const getJobPosition = (job: JobWithCustomer) => {
    if (!job.scheduled_start) return { top: 0, height: 60 };

    const start = new Date(job.scheduled_start);
    const end = job.scheduled_end ? new Date(job.scheduled_end) : addDays(start, 0);
    const dayStart = setMinutes(setHours(start, START_HOUR), 0);

    const topMinutes = differenceInMinutes(start, dayStart);
    const duration = differenceInMinutes(end, start) || 60;

    return {
      top: (topMinutes / 60) * HOUR_HEIGHT,
      height: Math.max((duration / 60) * HOUR_HEIGHT, 30),
    };
  };

  const getJobConflicts = (job: JobWithCustomer) => {
    return findConflicts(allJobs, {
      jobId: job.id,
      assignedTo: job.assigned_to,
      scheduledStart: job.scheduled_start,
      scheduledEnd: job.scheduled_end,
    });
  };

  const handleTimeSlotClick = (day: Date, hour: number) => {
    const date = setMinutes(setHours(day, hour), 0);
    onTimeSlotClick(date);
  };

  // Current time indicator
  const now = new Date();
  const currentTimeTop = useMemo(() => {
    const dayStart = setMinutes(setHours(now, START_HOUR), 0);
    const minutes = differenceInMinutes(now, dayStart);
    return (minutes / 60) * HOUR_HEIGHT;
  }, []);

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header with day names */}
      <div className="grid grid-cols-8 border-b sticky top-0 bg-background z-10">
        <div className="p-2 text-xs text-muted-foreground border-r" />
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              "p-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-primary/5"
            )}
          >
            <div className="text-xs text-muted-foreground">
              {format(day, "EEE")}
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                isToday(day) &&
                  "bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto"
              )}
            >
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-8 relative">
          {/* Time labels */}
          <div className="border-r">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b text-xs text-muted-foreground pr-2 text-right relative"
              >
                <span className="absolute -top-2 right-2">
                  {format(setHours(new Date(), hour), "h a")}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayJobs = getJobsForDay(day);
            const showCurrentTime = isToday(day);

            return (
              <div
                key={dayIndex}
                className={cn(
                  "relative border-r last:border-r-0",
                  isToday(day) && "bg-primary/5"
                )}
              >
                {/* Hour slots */}
                {HOURS.map((hour) => (
                  <DroppableTimeSlot
                    key={hour}
                    id={`week-${format(day, 'yyyy-MM-dd')}-${hour}`}
                    day={day}
                    hour={hour}
                    className="h-[60px] border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleTimeSlotClick(day, hour)}
                  />
                ))}

                {/* Current time indicator */}
                {showCurrentTime && currentTimeTop > 0 && currentTimeTop < HOURS.length * HOUR_HEIGHT && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div className="flex-1 h-0.5 bg-destructive" />
                    </div>
                  </div>
                )}

                {/* Jobs */}
                <div className="absolute inset-0 p-0.5 pointer-events-none">
                  {dayJobs.map((job) => {
                    const { top, height } = getJobPosition(job);
                    const conflicts = getJobConflicts(job);
                    return (
                      <div
                        key={job.id}
                        className="absolute left-0.5 right-0.5 pointer-events-auto"
                        style={{ top, height: Math.max(height, 24) }}
                      >
                        <DraggableJobCard
                          job={job}
                          variant="week"
                          onClick={onJobClick}
                          onResize={onJobResize}
                          className="h-full"
                          hasConflict={conflicts.length > 0}
                          conflictMessage={conflicts[0]?.message}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
