import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { usePhoneIntegrationLogs, usePhoneIntegrationStats, PhoneIntegrationLog } from "@/hooks/usePhoneIntegrationLogs";

interface PhoneIntegrationLogsProps {
  integrationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ statusCode }: { statusCode: number }) {
  if (statusCode >= 200 && statusCode < 300) {
    return <Badge variant="outline" className="border-green-500 text-green-600">200</Badge>;
  }
  if (statusCode >= 400 && statusCode < 500) {
    return <Badge variant="outline" className="border-amber-500 text-amber-600">{statusCode}</Badge>;
  }
  if (statusCode >= 500) {
    return <Badge variant="destructive">{statusCode}</Badge>;
  }
  return <Badge variant="secondary">{statusCode}</Badge>;
}

function ResponseCodeBadge({ code }: { code: string | null }) {
  if (!code) return <span className="text-muted-foreground">-</span>;
  
  const isSuccess = code === "SUCCESS";
  const isPermissionError = code === "PERMISSION_DENIED";
  const isValidationError = code === "VALIDATION_ERROR";
  
  return (
    <Badge
      variant="outline"
      className={
        isSuccess
          ? "border-green-500/50 text-green-600 bg-green-500/10"
          : isPermissionError
          ? "border-amber-500/50 text-amber-600 bg-amber-500/10"
          : isValidationError
          ? "border-orange-500/50 text-orange-600 bg-orange-500/10"
          : "border-red-500/50 text-red-600 bg-red-500/10"
      }
    >
      {code}
    </Badge>
  );
}

export function PhoneIntegrationLogs({ integrationId, open, onOpenChange }: PhoneIntegrationLogsProps) {
  const [endpointFilter, setEndpointFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const { data: logs, isLoading, refetch, isFetching } = usePhoneIntegrationLogs(integrationId, 500);
  const { data: stats } = usePhoneIntegrationStats(integrationId);

  // Filter logs
  const filteredLogs = (logs || []).filter((log) => {
    if (endpointFilter === "all") return true;
    if (endpointFilter === "errors") return log.status_code >= 400;
    return log.endpoint === endpointFilter;
  });

  // Paginate
  const paginatedLogs = filteredLogs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // Get unique endpoints for filter
  const uniqueEndpoints = [...new Set((logs || []).map((l) => l.endpoint))].sort();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Request Logs
          </SheetTitle>
          <SheetDescription>
            View all API requests made through the SG Phone integration
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Stats Summary */}
          {stats && stats.total_requests > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{stats.total_requests}</p>
                <p className="text-xs text-muted-foreground">24h Requests</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.success_count}</p>
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center">
                <p className="text-2xl font-bold text-red-600">{stats.error_count}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{stats.avg_duration_ms}ms</p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Select value={endpointFilter} onValueChange={setEndpointFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by endpoint" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Endpoints</SelectItem>
                <SelectItem value="errors">Errors Only</SelectItem>
                {uniqueEndpoints.map((endpoint) => (
                  <SelectItem key={endpoint} value={endpoint}>
                    {endpoint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredLogs.length} logs
            </span>
          </div>

          {/* Logs Table */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : paginatedLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No API requests logged yet</p>
                <p className="text-sm">Logs will appear when the API is used</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead className="w-[60px]">Method</TableHead>
                    <TableHead className="w-[60px]">Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead className="w-[80px] text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground" title={format(new Date(log.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {log.method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge statusCode={log.status_code} />
                      </TableCell>
                      <TableCell>
                        <ResponseCodeBadge code={log.response_code} />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {log.duration_ms != null ? `${log.duration_ms}ms` : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
