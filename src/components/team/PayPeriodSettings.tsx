import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Calendar,
  Lock,
  Unlock,
  Plus,
  Download,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePayPeriods,
  useGeneratePayPeriod,
  useLockPayPeriod,
  useUnlockPayPeriod,
} from "@/hooks/usePayPeriods";
import { useTimesheetApprovalStats } from "@/hooks/useTimesheetApprovals";
import { PayrollExportDialog } from "./PayrollExportDialog";

type PeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";

export function PayPeriodSettings() {
  const [periodType, setPeriodType] = useState<PeriodType>("biweekly");
  const [startDay, setStartDay] = useState<string>("0"); // Sunday
  const [confirmLock, setConfirmLock] = useState<string | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState<string | null>(null);
  const [exportPeriodId, setExportPeriodId] = useState<string | null>(null);

  const { data: payPeriods, isLoading } = usePayPeriods();
  const generatePeriod = useGeneratePayPeriod();
  const lockPeriod = useLockPayPeriod();
  const unlockPeriod = useUnlockPayPeriod();

  const handleGeneratePeriod = async () => {
    try {
      await generatePeriod.mutateAsync({ periodType });
      toast.success("Pay period generated successfully");
    } catch (error) {
      toast.error("Failed to generate pay period");
    }
  };

  const handleLockPeriod = async (periodId: string) => {
    try {
      await lockPeriod.mutateAsync(periodId);
      toast.success("Pay period locked");
      setConfirmLock(null);
    } catch (error) {
      toast.error("Failed to lock pay period");
    }
  };

  const handleUnlockPeriod = async (periodId: string) => {
    try {
      await unlockPeriod.mutateAsync(periodId);
      toast.success("Pay period unlocked");
      setConfirmUnlock(null);
    } catch (error) {
      toast.error("Failed to unlock pay period");
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "locked") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Lock className="h-3 w-3" />
          Locked
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Unlock className="h-3 w-3" />
        Open
      </Badge>
    );
  };

  const exportPeriod = payPeriods?.find((p) => p.id === exportPeriodId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Pay Period Settings
          </CardTitle>
          <CardDescription>
            Configure pay period frequency and manage payroll cycles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pay Period Type</label>
              <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="semimonthly">Semi-monthly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Week Starts On</label>
              <Select value={startDay} onValueChange={setStartDay}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGeneratePeriod}
              disabled={generatePeriod.isPending}
            >
              {generatePeriod.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate Next Period
            </Button>
          </div>

          {/* Pay Periods Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Labor Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payPeriods?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No pay periods yet. Generate your first pay period to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  payPeriods?.map((period) => (
                    <PayPeriodRow
                      key={period.id}
                      period={period}
                      onLock={() => setConfirmLock(period.id)}
                      onUnlock={() => setConfirmUnlock(period.id)}
                      onExport={() => setExportPeriodId(period.id)}
                      getStatusBadge={getStatusBadge}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Lock Confirmation Dialog */}
      <AlertDialog open={!!confirmLock} onOpenChange={() => setConfirmLock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Pay Period?</AlertDialogTitle>
            <AlertDialogDescription>
              Locking this pay period will prevent any further edits to time entries.
              This action can be undone by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmLock && handleLockPeriod(confirmLock)}
              disabled={lockPeriod.isPending}
            >
              {lockPeriod.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lock Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock Confirmation Dialog */}
      <AlertDialog open={!!confirmUnlock} onOpenChange={() => setConfirmUnlock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock Pay Period?</AlertDialogTitle>
            <AlertDialogDescription>
              Unlocking this pay period will allow edits to time entries again.
              Use with caution if payroll has already been processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUnlock && handleUnlockPeriod(confirmUnlock)}
              disabled={unlockPeriod.isPending}
            >
              {unlockPeriod.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unlock Period
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Dialog */}
      {exportPeriod && (
        <PayrollExportDialog
          period={exportPeriod}
          open={!!exportPeriodId}
          onOpenChange={(open) => !open && setExportPeriodId(null)}
        />
      )}
    </>
  );
}

// Separate component for each row to enable individual stats queries
function PayPeriodRow({
  period,
  onLock,
  onUnlock,
  onExport,
  getStatusBadge,
}: {
  period: {
    id: string;
    start_date: string;
    end_date: string;
    status: string;
    total_hours: number | null;
    total_labor_cost: number | null;
  };
  onLock: () => void;
  onUnlock: () => void;
  onExport: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const { data: stats } = useTimesheetApprovalStats(period.id);

  const totalApprovals = (stats?.approved || 0) + (stats?.submitted || 0) + (stats?.rejected || 0) + (stats?.draft || 0);
  const approvedCount = stats?.approved || 0;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">
          {format(new Date(period.start_date), "MMM d")} -{" "}
          {format(new Date(period.end_date), "MMM d, yyyy")}
        </div>
      </TableCell>
      <TableCell>{getStatusBadge(period.status)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {approvedCount === totalApprovals && totalApprovals > 0 ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span>
            {approvedCount}/{totalApprovals}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {period.total_hours?.toFixed(1) || "0.0"} hrs
      </TableCell>
      <TableCell>
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(period.total_labor_cost || 0)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
          {period.status === "open" ? (
            <Button variant="outline" size="sm" onClick={onLock}>
              <Lock className="h-4 w-4 mr-1" />
              Lock
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onUnlock}>
                <Unlock className="h-4 w-4 mr-1" />
                Unlock
              </Button>
              <Button variant="default" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
