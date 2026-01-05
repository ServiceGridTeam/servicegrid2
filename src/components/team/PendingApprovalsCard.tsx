import { format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Loader2, AlertCircle } from "lucide-react";
import {
  usePendingTimeOffRequests,
  useApproveTimeOffRequest,
  useRejectTimeOffRequest,
} from "@/hooks/useTimeOffRequests";
import { toast } from "sonner";

export function PendingApprovalsCard() {
  const { data: pendingRequests = [], isLoading } = usePendingTimeOffRequests();
  const approveRequest = useApproveTimeOffRequest();
  const rejectRequest = useRejectTimeOffRequest();

  const handleApprove = async (id: string) => {
    try {
      await approveRequest.mutateAsync(id);
      toast.success("Request approved");
    } catch (error) {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRequest.mutateAsync(id);
      toast.success("Request rejected");
    } catch (error) {
      toast.error("Failed to reject request");
    }
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isSameDay(start, end)) {
      return format(start, "MMM d");
    }
    
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">Pending Approvals</CardTitle>
        </div>
        <CardDescription>
          {pendingRequests.length} time off request{pendingRequests.length !== 1 ? "s" : ""} waiting for review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRequests.map((request) => {
          const user = request.user as { first_name: string | null; last_name: string | null; avatar_url?: string | null } | null;
          
          return (
            <div
              key={request.id}
              className="flex items-center gap-3 rounded-lg border bg-background p-3"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(user?.first_name, user?.last_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatDateRange(request.start_date, request.end_date)}
                  {request.reason && ` • ${request.reason}`}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                  onClick={() => handleApprove(request.id)}
                  disabled={approveRequest.isPending || rejectRequest.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleReject(request.id)}
                  disabled={approveRequest.isPending || rejectRequest.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
