import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWeeklySchedule, useBulkUpdateAvailability } from "@/hooks/useTeamAvailability";
import { DAY_NAMES } from "@/types/routePlanning";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WeeklyScheduleEditorProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
];

export function WeeklyScheduleEditor({
  userId,
  userName,
  open,
  onOpenChange,
}: WeeklyScheduleEditorProps) {
  const { data: weeklySchedule, isLoading } = useWeeklySchedule(userId);
  const bulkUpdate = useBulkUpdateAvailability();
  
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);

  // Initialize schedule from fetched data
  useEffect(() => {
    if (weeklySchedule?.schedule) {
      setSchedule(weeklySchedule.schedule);
    }
  }, [weeklySchedule]);

  const handleDayToggle = (dayOfWeek: number, checked: boolean) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, isAvailable: checked } : day
      )
    );
  };

  const handleTimeChange = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    setSchedule((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSave = async () => {
    try {
      await bulkUpdate.mutateAsync({
        userId,
        schedules: schedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          startTime: day.startTime,
          endTime: day.endTime,
          isAvailable: day.isAvailable,
        })),
      });
      toast.success("Schedule saved successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save schedule");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Weekly Schedule</DialogTitle>
          <DialogDescription>
            Configure {userName}'s typical working hours for each day of the week.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {schedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2 w-28">
                  <Checkbox
                    id={`day-${day.dayOfWeek}`}
                    checked={day.isAvailable}
                    onCheckedChange={(checked) =>
                      handleDayToggle(day.dayOfWeek, checked === true)
                    }
                  />
                  <Label
                    htmlFor={`day-${day.dayOfWeek}`}
                    className="font-medium cursor-pointer"
                  >
                    {day.dayName}
                  </Label>
                </div>

                {day.isAvailable ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Select
                      value={day.startTime}
                      onValueChange={(value) =>
                        handleTimeChange(day.dayOfWeek, "startTime", value)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select
                      value={day.endTime}
                      onValueChange={(value) =>
                        handleTimeChange(day.dayOfWeek, "endTime", value)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not working</span>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={bulkUpdate.isPending}>
            {bulkUpdate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
