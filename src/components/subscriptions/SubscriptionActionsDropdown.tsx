import { useState } from "react";
import { format, addDays } from "date-fns";
import { 
  Pause, 
  Play, 
  XCircle, 
  MoreVertical, 
  Edit, 
  RefreshCw,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  usePauseSubscription,
  useResumeSubscription,
  useCancelSubscription,
  useRegenerateSchedules,
} from "@/hooks/useSubscriptionActions";

interface SubscriptionActionsDropdownProps {
  subscriptionId: string;
  status: string;
  onEdit?: () => void;
}

export function SubscriptionActionsDropdown({
  subscriptionId,
  status,
  onEdit,
}: SubscriptionActionsDropdownProps) {
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);

  const pauseSubscription = usePauseSubscription();
  const resumeSubscription = useResumeSubscription();
  const cancelSubscription = useCancelSubscription();
  const regenerateSchedules = useRegenerateSchedules();

  // Pause form state
  const [pauseStartDate, setPauseStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pauseEndDate, setPauseEndDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [pauseReason, setPauseReason] = useState("");

  // Cancel form state
  const [cancelReason, setCancelReason] = useState("");

  // Regenerate form state
  const [monthsAhead, setMonthsAhead] = useState("3");

  const canPause = status === "active";
  const canResume = status === "paused";
  const canCancel = ["draft", "pending_payment", "active", "paused"].includes(status);

  const handlePause = async () => {
    await pauseSubscription.mutateAsync({
      subscriptionId,
      pauseStartDate,
      pauseEndDate,
      reason: pauseReason || undefined,
    });
    setIsPauseOpen(false);
    setPauseReason("");
  };

  const handleResume = async () => {
    await resumeSubscription.mutateAsync(subscriptionId);
  };

  const handleCancel = async () => {
    await cancelSubscription.mutateAsync({
      subscriptionId,
      reason: cancelReason,
    });
    setIsCancelOpen(false);
    setCancelReason("");
  };

  const handleRegenerate = async () => {
    await regenerateSchedules.mutateAsync({
      subscriptionId,
      monthsAhead: parseInt(monthsAhead) || 3,
    });
    setIsRegenerateOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Subscription
            </DropdownMenuItem>
          )}
          
          {canPause && (
            <DropdownMenuItem onClick={() => setIsPauseOpen(true)}>
              <Pause className="h-4 w-4 mr-2" />
              Pause Subscription
            </DropdownMenuItem>
          )}

          {canResume && (
            <DropdownMenuItem 
              onClick={handleResume}
              disabled={resumeSubscription.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Subscription
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => setIsRegenerateOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Schedules
          </DropdownMenuItem>

          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsCancelOpen(true)}
                className="text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Subscription
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pause Dialog */}
      <Dialog open={isPauseOpen} onOpenChange={setIsPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause Subscription</DialogTitle>
            <DialogDescription>
              Temporarily pause this subscription. Scheduled visits during the pause period 
              will be marked as paused.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pause-start">Start Date</Label>
                <Input
                  id="pause-start"
                  type="date"
                  value={pauseStartDate}
                  onChange={(e) => setPauseStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pause-end">End Date</Label>
                <Input
                  id="pause-end"
                  type="date"
                  value={pauseEndDate}
                  onChange={(e) => setPauseEndDate(e.target.value)}
                  min={pauseStartDate}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pause-reason">Reason (optional)</Label>
              <Textarea
                id="pause-reason"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="e.g., Customer on vacation"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPauseOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePause}
              disabled={pauseSubscription.isPending || !pauseStartDate || !pauseEndDate}
            >
              {pauseSubscription.isPending ? "Pausing..." : "Pause Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Dialog */}
      <Dialog open={isRegenerateOpen} onOpenChange={setIsRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Schedules</DialogTitle>
            <DialogDescription>
              Generate new scheduled visits for this subscription. Existing pending 
              schedules will be preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="months-ahead">Months Ahead</Label>
              <Input
                id="months-ahead"
                type="number"
                min="1"
                max="12"
                value={monthsAhead}
                onChange={(e) => setMonthsAhead(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Number of months to generate schedules for (1-12)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegenerateOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRegenerate}
              disabled={regenerateSchedules.isPending}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {regenerateSchedules.isPending ? "Generating..." : "Generate Schedules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel AlertDialog */}
      <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this subscription? This action cannot be 
              undone. Any remaining scheduled visits will be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="cancel-reason">Cancellation Reason</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this subscription being cancelled?"
              className="mt-2"
              rows={2}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelSubscription.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelSubscription.isPending ? "Cancelling..." : "Cancel Subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
