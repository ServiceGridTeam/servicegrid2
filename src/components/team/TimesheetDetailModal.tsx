import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  FileText,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  TimesheetApprovalWithDetails,
  useApproveTimesheet,
  useRejectTimesheet,
} from "@/hooks/useTimesheetApprovals";
import { useTimeEntriesForDateRange, TimeEntryWithDetails } from "@/hooks/useTimeEntries";
import { useTimesheetAnomalies } from "@/hooks/useTimesheetAnomalies";

interface TimesheetDetailModalProps {
  approval: TimesheetApprovalWithDetails | null;
  onClose: () => void;
}

export function TimesheetDetailModal({ approval, onClose }: TimesheetDetailModalProps) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useApproveTimesheet();
  const rejectMutation = useRejectTimesheet();

  const startDate = approval?.pay_period?.start_date
    ? parseISO(approval.pay_period.start_date)
    : new Date();
  const endDate = approval?.pay_period?.end_date
    ? parseISO(approval.pay_period.end_date)
    : new Date();

  const { data: entries, isLoading: entriesLoading } = useTimeEntriesForDateRange(
    startDate,
    endDate,
    approval?.user_id
  );

  const { data: anomalies } = useTimesheetAnomalies(
    startDate,
    endDate,
    approval?.user_id || undefined
  );

  const handleApprove = async () => {
    if (!approval) return;
    try {
      await approveMutation.mutateAsync({
        approvalId: approval.id,
        notes: reviewNotes || undefined,
      });
      toast.success("Timesheet approved");
      onClose();
    } catch (error) {
      toast.error("Failed to approve timesheet");
    }
  };

  const handleReject = async () => {
    if (!approval || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      await rejectMutation.mutateAsync({
        approvalId: approval.id,
        rejectionReason: rejectionReason.trim(),
      });
      toast.success("Timesheet rejected");
      onClose();
    } catch (error) {
      toast.error("Failed to reject timesheet");
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0h 0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getEntryAnomalies = (entry: TimeEntryWithDetails) => {
    const issues: string[] = [];
    if (entry.is_manual) issues.push("Manual entry");
    if (entry.edited_at) issues.push("Edited");
    
    // Check geofence violations from violations array
    const geofenceViolation = anomalies?.violations?.find(
      (v) => v.entryId === entry.id || 
             v.entryId === entry.clock_in_event_id || 
             v.entryId === entry.clock_out_event_id
    );
    if (geofenceViolation && geofenceViolation.type === "geofence") {
      issues.push(geofenceViolation.details);
    }
    
    return issues;
  };

  if (!approval) return null;

  const isSubmitted = approval.status === "submitted";
  const canTakeAction = isSubmitted;

  return (
    <Dialog open={!!approval} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={approval.user?.avatar_url || undefined} />
              <AvatarFallback>
                {getInitials(approval.user?.first_name, approval.user?.last_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <span>
                {approval.user?.first_name} {approval.user?.last_name}
              </span>
              <p className="text-sm font-normal text-muted-foreground">
                {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Review time entries and approve or reject the timesheet
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {/* Summary Section */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Hours</p>
              <p className="text-2xl font-bold">{approval.total_hours?.toFixed(1) || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Regular Hours</p>
              <p className="text-2xl font-bold">{approval.regular_hours?.toFixed(1) || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Overtime Hours</p>
              <p className="text-2xl font-bold text-amber-500">
                {approval.overtime_hours?.toFixed(1) || 0}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Labor Cost</p>
              <p className="text-2xl font-bold">{formatCurrency(approval.total_labor_cost)}</p>
            </div>
          </div>

          {/* Anomalies Alert */}
          {approval.has_anomalies && (
            <div className="flex items-start gap-3 p-4 mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  This timesheet has anomalies
                </p>
                <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                  {anomalies?.geofenceViolations && anomalies.geofenceViolations > 0 && (
                    <li className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {anomalies.geofenceViolations} geofence violation(s)
                    </li>
                  )}
                  {anomalies?.manualEntries && anomalies.manualEntries > 0 && (
                    <li className="flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      {anomalies.manualEntries} manual entr{anomalies.manualEntries === 1 ? "y" : "ies"}
                    </li>
                  )}
                  {anomalies?.editedEntries && anomalies.editedEntries > 0 && (
                    <li className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {anomalies.editedEntries} edited entr{anomalies.editedEntries === 1 ? "y" : "ies"}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Submitted Notes */}
          {approval.submitted_notes && (
            <div className="mb-6">
              <Label className="text-sm font-medium">Employee Notes</Label>
              <p className="mt-1 p-3 rounded-lg bg-muted/50 text-sm">
                {approval.submitted_notes}
              </p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Time Entries Table */}
          <div className="mb-6">
            <h3 className="font-medium mb-3">Time Entries ({entries?.length || 0})</h3>
            {entriesLoading ? (
              <p className="text-muted-foreground">Loading entries...</p>
            ) : entries?.length === 0 ? (
              <p className="text-muted-foreground">No time entries for this period</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries?.map((entry) => {
                    const entryAnomalies = getEntryAnomalies(entry);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {format(new Date(entry.clock_in), "EEE, MMM d")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {entry.job?.job_number || "N/A"}
                            </p>
                            {entry.job?.customer && (
                              <p className="text-xs text-muted-foreground">
                                {entry.job.customer.first_name} {entry.job.customer.last_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(entry.clock_in), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          {entry.clock_out
                            ? format(new Date(entry.clock_out), "h:mm a")
                            : "In progress"}
                        </TableCell>
                        <TableCell>{formatDuration(entry.duration_minutes)}</TableCell>
                        <TableCell>
                          {entryAnomalies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {entryAnomalies.map((issue, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs text-amber-600 border-amber-300"
                                >
                                  {issue}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Review Section */}
          {canTakeAction && !showRejectForm && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reviewNotes">Approval Notes (optional)</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add notes for approval..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div className="space-y-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
              <div>
                <Label htmlFor="rejectionReason" className="text-destructive">
                  Rejection Reason (required)
                </Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="Explain why this timesheet is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || !rejectionReason.trim()}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirm Rejection
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Already Reviewed Info */}
          {(approval.status === "approved" || approval.status === "rejected") && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                {approval.status === "approved" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {approval.status === "approved" ? "Approved" : "Rejected"}
                </span>
                {approval.reviewed_at && (
                  <span className="text-sm text-muted-foreground">
                    on {format(new Date(approval.reviewed_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                )}
              </div>
              {approval.reviewer && (
                <p className="text-sm text-muted-foreground">
                  By {approval.reviewer.first_name} {approval.reviewer.last_name}
                </p>
              )}
              {approval.review_notes && (
                <p className="text-sm mt-2">{approval.review_notes}</p>
              )}
              {approval.rejection_reason && (
                <p className="text-sm mt-2 text-destructive">{approval.rejection_reason}</p>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canTakeAction && !showRejectForm && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={approveMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Timesheet
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
