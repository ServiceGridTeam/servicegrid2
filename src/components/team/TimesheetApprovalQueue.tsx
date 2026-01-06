import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  DollarSign,
} from "lucide-react";
import { usePayPeriods, useCurrentPayPeriod } from "@/hooks/usePayPeriods";
import {
  usePendingTimesheetApprovals,
  useTimesheetApprovalsForPeriod,
  useTimesheetApprovalStats,
  TimesheetApprovalWithDetails,
} from "@/hooks/useTimesheetApprovals";
import { TimesheetDetailModal } from "./TimesheetDetailModal";

export function TimesheetApprovalQueue() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | undefined>();
  const [selectedApproval, setSelectedApproval] = useState<TimesheetApprovalWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: payPeriods, isLoading: periodsLoading } = usePayPeriods();
  const { data: currentPeriod } = useCurrentPayPeriod();
  const activePeriodId = selectedPeriodId || currentPeriod?.id;
  
  const { data: stats, isLoading: statsLoading } = useTimesheetApprovalStats(activePeriodId);
  const { data: approvals, isLoading: approvalsLoading } = useTimesheetApprovalsForPeriod(activePeriodId);
  const { data: pendingApprovals } = usePendingTimesheetApprovals();

  const filteredApprovals = approvals?.filter((a) => {
    if (statusFilter === "all") return true;
    return a.status === statusFilter;
  }) || [];

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      draft: { variant: "secondary", icon: <FileText className="h-3 w-3" /> },
      submitted: { variant: "default", icon: <Clock className="h-3 w-3" /> },
      approved: { variant: "outline", icon: <CheckCircle className="h-3 w-3 text-green-500" /> },
      rejected: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      revised: { variant: "secondary", icon: <FileText className="h-3 w-3" /> },
    };
    const config = variants[status] || variants.draft;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatHours = (hours: number | null) => {
    if (hours === null || hours === undefined) return "0.0";
    return hours.toFixed(1);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (periodsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <Select
            value={activePeriodId}
            onValueChange={setSelectedPeriodId}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select pay period" />
            </SelectTrigger>
            <SelectContent>
              {payPeriods?.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {format(new Date(period.start_date), "MMM d")} -{" "}
                  {format(new Date(period.end_date), "MMM d, yyyy")}
                  {period.id === currentPeriod?.id && " (Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.submitted || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.approved || 0}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.rejected || 0}
            </div>
            <p className="text-xs text-muted-foreground">Needs revision</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Submitted</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.draft || 0}
            </div>
            <p className="text-xs text-muted-foreground">Still in draft</p>
          </CardContent>
        </Card>
      </div>

      {/* Approval List */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheets</CardTitle>
        </CardHeader>
        <CardContent>
          {approvalsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No timesheets found for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedApproval(approval)}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={approval.user?.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(approval.user?.first_name, approval.user?.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {approval.user?.first_name} {approval.user?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {approval.submitted_at
                          ? `Submitted ${format(new Date(approval.submitted_at), "MMM d, h:mm a")}`
                          : "Not yet submitted"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Hours Summary */}
                    <div className="text-right">
                      <p className="font-medium">{formatHours(approval.total_hours)} hrs</p>
                      <p className="text-sm text-muted-foreground">
                        {formatHours(approval.regular_hours)} reg + {formatHours(approval.overtime_hours)} OT
                      </p>
                    </div>

                    {/* Labor Cost */}
                    <div className="text-right min-w-[80px]">
                      <p className="font-medium flex items-center gap-1 justify-end">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(approval.total_labor_cost).replace("$", "")}
                      </p>
                    </div>

                    {/* Anomalies */}
                    {approval.has_anomalies && (
                      <div className="flex items-center gap-1 text-amber-500">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Issues</span>
                      </div>
                    )}

                    {/* Status */}
                    {getStatusBadge(approval.status)}

                    {/* Actions */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedApproval(approval);
                      }}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <TimesheetDetailModal
        approval={selectedApproval}
        onClose={() => setSelectedApproval(null)}
      />
    </div>
  );
}
