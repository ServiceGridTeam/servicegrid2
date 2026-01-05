import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  MessageSquare, 
  CheckCircle,
  User,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";
import type { AutoAssignResult } from "@/hooks/useAutoAssign";
import type { JobWithCustomer } from "@/hooks/useJobs";

interface AutoAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AutoAssignResult | null;
  job: JobWithCustomer;
}

export function AutoAssignDialog({
  open,
  onOpenChange,
  result,
  job,
}: AutoAssignDialogProps) {
  if (!result || !result.success || !result.assignment) {
    return null;
  }

  const { assignment, reasoning, alternatives } = result;
  const scheduledStart = new Date(assignment.scheduledStart);
  const scheduledEnd = new Date(assignment.scheduledEnd);

  // Get initials for avatar
  const nameParts = assignment.userName.split(" ");
  const initials = nameParts.map(p => p[0]).join("").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Job Auto-Assigned
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job info */}
          <div className="text-sm text-muted-foreground">
            {job.title || job.job_number}
            {job.address_line1 && (
              <span className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" />
                {job.address_line1}, {job.city}
              </span>
            )}
          </div>

          <Separator />

          {/* Assignment details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{assignment.userName}</span>
                  <Badge variant="secondary" className="text-xs">
                    Recommended
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Route Position: #{assignment.routePosition}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(scheduledStart, "EEE, MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {format(scheduledStart, "h:mm a")} - {format(scheduledEnd, "h:mm a")}
                </span>
              </div>
            </div>

            {/* AI Reasoning */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground italic">
                  "{reasoning}"
                </p>
              </div>
            </div>
          </div>

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Other available team members
              </p>
              <div className="space-y-2">
                {alternatives.map((alt) => (
                  <div
                    key={alt.userId}
                    className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{alt.userName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {alt.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full gap-2">
            <CheckCircle className="h-4 w-4" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
