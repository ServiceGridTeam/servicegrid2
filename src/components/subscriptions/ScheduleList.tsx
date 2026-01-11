import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Calendar, Clock, SkipForward, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSkipScheduledVisit } from "@/hooks/useSubscriptionActions";
import { cn } from "@/lib/utils";

export interface SubscriptionSchedule {
  id: string;
  subscription_id: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  status: "pending" | "job_created" | "skipped" | "paused" | "completed";
  version: number;
  job_id: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
}

interface ScheduleListProps {
  schedules: SubscriptionSchedule[];
  isLoading?: boolean;
  subscriptionId: string;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: { 
    label: "Pending", 
    icon: <Clock className="h-3 w-3" />,
    className: "bg-foreground/5 text-foreground/70 border-foreground/10" 
  },
  job_created: { 
    label: "Job Created", 
    icon: <CheckCircle className="h-3 w-3" />,
    className: "bg-foreground/15 text-foreground border-foreground/20" 
  },
  skipped: { 
    label: "Skipped", 
    icon: <SkipForward className="h-3 w-3" />,
    className: "bg-muted text-muted-foreground border-border" 
  },
  paused: { 
    label: "Paused", 
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-warning/20 text-warning-foreground border-warning/30" 
  },
  completed: { 
    label: "Completed", 
    icon: <CheckCircle className="h-3 w-3" />,
    className: "bg-foreground/15 text-foreground border-foreground/20" 
  },
};

function ScheduleListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

interface ScheduleRowProps {
  schedule: SubscriptionSchedule;
  subscriptionId: string;
}

function ScheduleRow({ schedule, subscriptionId }: ScheduleRowProps) {
  const [isSkipOpen, setIsSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const skipVisit = useSkipScheduledVisit();

  const config = statusConfig[schedule.status] || statusConfig.pending;
  const isSkipped = schedule.status === "skipped";
  const isPast = new Date(schedule.scheduled_date) < new Date();
  const canSkip = schedule.status === "pending" && !isPast;

  const handleSkip = async () => {
    await skipVisit.mutateAsync({
      scheduleId: schedule.id,
      reason: skipReason || undefined,
      subscriptionId,
    });
    setIsSkipOpen(false);
    setSkipReason("");
  };

  return (
    <>
      <motion.div
        layout
        className={cn(
          "flex items-center justify-between p-3 border rounded-lg transition-colors",
          isSkipped && "bg-muted/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className={cn("font-medium", isSkipped && "line-through text-muted-foreground")}>
              {format(new Date(schedule.scheduled_date), "EEE, MMM d, yyyy")}
            </span>
          </div>
          {schedule.scheduled_time_start && (
            <span className="text-sm text-muted-foreground">
              {schedule.scheduled_time_start}
              {schedule.scheduled_time_end && ` - ${schedule.scheduled_time_end}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("gap-1", config.className)}>
            {config.icon}
            {config.label}
          </Badge>
          
          {canSkip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSkipOpen(true)}
              disabled={skipVisit.isPending}
            >
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
          )}
        </div>
      </motion.div>

      <Dialog open={isSkipOpen} onOpenChange={setIsSkipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Scheduled Visit</DialogTitle>
            <DialogDescription>
              Skip the visit scheduled for {format(new Date(schedule.scheduled_date), "MMMM d, yyyy")}. 
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason (optional)</Label>
              <Textarea
                id="skip-reason"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g., Customer on vacation"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkipOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSkip}
              disabled={skipVisit.isPending}
            >
              {skipVisit.isPending ? "Skipping..." : "Skip Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ScheduleList({ schedules, isLoading, subscriptionId }: ScheduleListProps) {
  if (isLoading) {
    return <ScheduleListSkeleton />;
  }

  if (!schedules?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No scheduled visits
      </div>
    );
  }

  // Split into upcoming and past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const upcoming = schedules.filter(s => new Date(s.scheduled_date) >= today);
  const past = schedules.filter(s => new Date(s.scheduled_date) < today);

  return (
    <div className="space-y-6">
      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Upcoming</h4>
          <AnimatePresence mode="popLayout">
            {upcoming.map((schedule) => (
              <ScheduleRow 
                key={schedule.id} 
                schedule={schedule} 
                subscriptionId={subscriptionId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Past</h4>
          <AnimatePresence mode="popLayout">
            {past.slice(0, 5).map((schedule) => (
              <ScheduleRow 
                key={schedule.id} 
                schedule={schedule} 
                subscriptionId={subscriptionId}
              />
            ))}
          </AnimatePresence>
          {past.length > 5 && (
            <p className="text-sm text-muted-foreground text-center">
              + {past.length - 5} more past visits
            </p>
          )}
        </div>
      )}
    </div>
  );
}
