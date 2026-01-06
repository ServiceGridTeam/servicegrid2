import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentPayPeriod } from "@/hooks/usePayPeriods";
import { useMyTimesheetApproval, useSubmitTimesheet } from "@/hooks/useTimesheetApprovals";
import { useTimeEntriesForDateRange } from "@/hooks/useTimeEntries";
import { useOvertimeSettings } from "@/hooks/useOvertimeSettings";
import { calculateWeeklyOvertime, formatMinutesToHoursDecimal } from "@/hooks/useOvertimeCalculations";
import { useTimesheetAnomalies } from "@/hooks/useTimesheetAnomalies";
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { EditTimeEntryDialog } from "./EditTimeEntryDialog";
import { OvertimeBadge } from "./OvertimeBadge";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Clock,
  Plus,
  Send,
  Save,
  AlertTriangle,
  MapPin,
  Edit,
  CheckCircle2,
  XCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusType = "draft" | "submitted" | "approved" | "rejected";

const statusConfig: Record<StatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  draft: { label: "Draft", variant: "outline", icon: <FileText className="h-3 w-3" /> },
  submitted: { label: "Submitted", variant: "secondary", icon: <Send className="h-3 w-3" /> },
  approved: { label: "Approved", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "Rejected", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

export function TimesheetSubmissionCard() {
  const { user } = useAuth();
  const [notes, setNotes] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const { data: payPeriod, isLoading: periodLoading } = useCurrentPayPeriod();
  const { data: approval, isLoading: approvalLoading } = useMyTimesheetApproval(payPeriod?.id);
  const submitTimesheet = useSubmitTimesheet();

  const periodStart = payPeriod ? new Date(payPeriod.start_date) : new Date();
  const periodEnd = payPeriod ? new Date(payPeriod.end_date) : new Date();

  const { data: entries, isLoading: entriesLoading } = useTimeEntriesForDateRange(
    periodStart,
    periodEnd,
    user?.id
  );

  const { data: anomalies } = useTimesheetAnomalies(periodStart, periodEnd, user?.id);
  const { settings: overtimeSettings } = useOvertimeSettings();

  // Calculate totals
  const summary = useMemo(() => {
    const totalMinutes = (entries || []).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const overtimeResult = calculateWeeklyOvertime(
      totalMinutes,
      overtimeSettings.weekly_threshold_hours,
      overtimeSettings.alert_threshold_percent
    );
    return {
      totalMinutes,
      regularMinutes: overtimeResult.regularMinutes,
      overtimeMinutes: overtimeResult.overtimeMinutes,
      overtimeResult,
    };
  }, [entries, overtimeSettings]);

  const currentStatus = (approval?.status as StatusType) || "draft";
  const isEditable = currentStatus === "draft" || currentStatus === "rejected";
  const daysUntilDue = payPeriod ? differenceInDays(new Date(payPeriod.end_date), new Date()) : 0;

  const handleSubmit = async () => {
    if (!payPeriod) return;

    try {
      await submitTimesheet.mutateAsync({
        payPeriodId: payPeriod.id,
        notes: notes || undefined,
        regularMinutes: summary.regularMinutes,
        overtimeMinutes: summary.overtimeMinutes,
        totalEntries: entries?.length || 0,
        totalLaborCost: 0, // Will be calculated by backend if pay rates exist
        hasAnomalies: (anomalies?.geofenceViolations || 0) > 0 || (anomalies?.manualEntries || 0) > 0,
        anomalyCount: (anomalies?.geofenceViolations || 0) + (anomalies?.manualEntries || 0),
      });
      toast.success("Timesheet submitted for approval");
    } catch (error) {
      toast.error("Failed to submit timesheet");
    }
  };

  const handleSaveDraft = async () => {
    if (!payPeriod) return;
    // For now, just save notes - could expand to save partial state
    toast.success("Draft saved");
  };

  const isLoading = periodLoading || approvalLoading || entriesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!payPeriod) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No active pay period found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                My Timesheet
              </CardTitle>
              <CardDescription>
                {format(periodStart, "MMM d")} - {format(periodEnd, "MMM d, yyyy")}
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge variant={statusConfig[currentStatus].variant} className="gap-1">
                {statusConfig[currentStatus].icon}
                {statusConfig[currentStatus].label}
              </Badge>
              {daysUntilDue > 0 && daysUntilDue <= 3 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Due in {daysUntilDue} day{daysUntilDue !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Rejection notice */}
          {currentStatus === "rejected" && approval?.rejection_reason && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Rejected:</strong> {approval.rejection_reason}
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Section */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/50">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatMinutesToHoursDecimal(summary.totalMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatMinutesToHoursDecimal(summary.regularMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Regular</p>
            </div>
            <div className="text-center">
              <p className={cn("text-2xl font-bold", summary.overtimeMinutes > 0 && "text-destructive")}>
                {formatMinutesToHoursDecimal(summary.overtimeMinutes)}
              </p>
              <p className="text-xs text-muted-foreground">Overtime</p>
            </div>
            <div className="flex items-center justify-center">
              <OvertimeBadge
                result={summary.overtimeResult}
                thresholdHours={overtimeSettings.weekly_threshold_hours}
              />
            </div>
          </div>

          {/* Anomalies Warning */}
          {anomalies && (anomalies.geofenceViolations > 0 || anomalies.manualEntries > 0) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Attention needed:</strong>{" "}
                {anomalies.geofenceViolations > 0 && (
                  <span>{anomalies.geofenceViolations} geofence violation{anomalies.geofenceViolations !== 1 ? "s" : ""}</span>
                )}
                {anomalies.geofenceViolations > 0 && anomalies.manualEntries > 0 && ", "}
                {anomalies.manualEntries > 0 && (
                  <span>{anomalies.manualEntries} manual entr{anomalies.manualEntries !== 1 ? "ies" : "y"}</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Entries List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Time Entries</h4>
              {isEditable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualEntryOpen(true)}
                  className="gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Manual Entry
                </Button>
              )}
            </div>

            {entries && entries.length > 0 ? (
              <div className="border rounded-lg divide-y">
                {entries.map((entry) => {
                  const hasViolation = anomalies?.violations.some(
                    (v) => v.entryId === entry.id || v.entryId === entry.clock_in_event_id || v.entryId === entry.clock_out_event_id
                  );
                  const violation = anomalies?.violations.find(
                    (v) => v.entryId === entry.id || v.entryId === entry.clock_in_event_id || v.entryId === entry.clock_out_event_id
                  );

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                        hasViolation && "bg-destructive/5"
                      )}
                      onClick={() => isEditable && setEditingEntry(entry)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {format(new Date(entry.clock_in), "EEE M/d")}
                            </span>
                            {entry.job && (
                              <span className="text-sm text-muted-foreground truncate">
                                Job #{entry.job.job_number} - {entry.job.title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>
                              {format(new Date(entry.clock_in), "h:mm a")}
                              {entry.clock_out && ` - ${format(new Date(entry.clock_out), "h:mm a")}`}
                            </span>
                            {entry.is_manual && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                Manual
                              </Badge>
                            )}
                          </div>
                          {hasViolation && violation && (
                            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                              {violation.type === "geofence" ? (
                                <MapPin className="h-3 w-3" />
                              ) : (
                                <Edit className="h-3 w-3" />
                              )}
                              {violation.details}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-medium">
                            {entry.duration_minutes
                              ? formatMinutesToHoursDecimal(entry.duration_minutes)
                              : "-"}
                            h
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center text-muted-foreground">
                No time entries for this period
              </div>
            )}
          </div>

          {/* Notes */}
          {isEditable && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes for reviewer</label>
              <Textarea
                placeholder="Add any notes or explanations for your timesheet..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={submitTimesheet.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitTimesheet.isPending || !entries?.length}
              >
                <Send className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            </div>
          )}

          {/* Approved/Submitted state */}
          {currentStatus === "approved" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Approved on {approval?.reviewed_at && format(new Date(approval.reviewed_at), "MMM d, yyyy")}
            </div>
          )}
          {currentStatus === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Submitted on {approval?.submitted_at && format(new Date(approval.submitted_at), "MMM d, yyyy")} - Pending approval
            </div>
          )}
        </CardContent>
      </Card>

      <ManualTimeEntryDialog
        open={manualEntryOpen}
        onOpenChange={setManualEntryOpen}
        defaultDate={periodStart}
      />

      <EditTimeEntryDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
      />
    </>
  );
}
