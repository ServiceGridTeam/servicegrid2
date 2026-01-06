import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobModificationRequest } from "@/hooks/useJobModificationRequests";

interface ModificationApprovalDialogProps {
  request: JobModificationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newScheduledStart?: string, newScheduledEnd?: string) => void;
  isLoading?: boolean;
}

export function ModificationApprovalDialog({
  request,
  open,
  onOpenChange,
  onConfirm,
  isLoading,
}: ModificationApprovalDialogProps) {
  const [date, setDate] = useState<Date | undefined>(
    request?.requested_date ? new Date(request.requested_date) : undefined
  );
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);

  const isReschedule = request?.modification_type === "reschedule";

  const handleConfirm = () => {
    if (isReschedule && date) {
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledStart = new Date(date);
      scheduledStart.setHours(hours, minutes, 0, 0);
      
      const scheduledEnd = new Date(scheduledStart);
      scheduledEnd.setMinutes(scheduledEnd.getMinutes() + duration);
      
      onConfirm(scheduledStart.toISOString(), scheduledEnd.toISOString());
    } else {
      onConfirm();
    }
  };

  const customerName = request?.job?.customer
    ? `${request.job.customer.first_name} ${request.job.customer.last_name}`
    : "Unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReschedule ? "Approve Reschedule" : "Confirm Cancellation"}
          </DialogTitle>
          <DialogDescription>
            {isReschedule
              ? "Set the new schedule for this job."
              : "This will mark the job as cancelled."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Job info */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="text-sm">
              <span className="text-muted-foreground">Job: </span>
              <span className="font-mono">{request?.job?.job_number}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Customer: </span>
              <span>{customerName}</span>
            </div>
            {request?.job?.scheduled_start && (
              <div className="text-sm">
                <span className="text-muted-foreground">Current: </span>
                <span>{format(new Date(request.job.scheduled_start), "MMM d, yyyy h:mm a")}</span>
              </div>
            )}
          </div>

          {isReschedule && (
            <>
              {/* Date picker */}
              <div className="space-y-2">
                <Label>New Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time picker */}
              <div className="space-y-2">
                <Label>New Time</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  min={15}
                  step={15}
                />
              </div>
            </>
          )}

          {!isReschedule && (
            <p className="text-sm text-muted-foreground">
              Are you sure you want to approve this cancellation? The job will be
              marked as cancelled and cannot be undone.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || (isReschedule && !date)}
          >
            {isLoading
              ? "Processing..."
              : isReschedule
              ? "Approve Reschedule"
              : "Approve Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
