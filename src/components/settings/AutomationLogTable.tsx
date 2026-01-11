import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, SkipForward, Clock, FileText, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutomationLogs, useAutomationLogsRealtime, AutomationLogStatus, AutomationLog } from '@/hooks/useAutomationLogs';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AutomationLogTableProps {
  ruleId?: string;
  showFilters?: boolean;
  limit?: number;
}

const statusConfig: Record<AutomationLogStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-600', label: 'Success' },
  failed: { icon: XCircle, color: 'text-red-600', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-yellow-600', label: 'Skipped' },
};

export function AutomationLogTable({ ruleId, showFilters = true, limit = 20 }: AutomationLogTableProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<AutomationLogStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const [localLogs, setLocalLogs] = useState<AutomationLog[]>([]);

  const { data, isLoading, error } = useAutomationLogs({
    ruleId,
    status: statusFilter,
    limit,
    page,
  });

  // Sync local logs with query data
  useEffect(() => {
    if (data?.logs) {
      setLocalLogs(data.logs);
    }
  }, [data?.logs]);

  // Realtime subscription
  const { subscribe } = useAutomationLogsRealtime((newLog) => {
    // Only add if matches current filter
    if (statusFilter === 'all' || newLog.status === statusFilter) {
      if (!ruleId || newLog.rule_id === ruleId) {
        setLocalLogs((prev) => [newLog, ...prev.slice(0, limit - 1)]);
      }
    }
  });

  useEffect(() => {
    const unsubscribe = subscribe();
    return () => {
      unsubscribe?.();
    };
  }, [statusFilter, ruleId]);

  const handleRowClick = (log: AutomationLog) => {
    if (log.target_type === 'invoice') {
      navigate(`/invoices/${log.target_id}`);
    }
  };

  // Loading state
  if (isLoading && localLogs.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p>Failed to load activity logs</p>
      </div>
    );
  }

  // Empty state
  if (localLogs.length === 0) {
    const emptyMessage = statusFilter === 'all'
      ? 'No automation activity yet'
      : `No ${statusFilter} entries`;

    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
        {statusFilter !== 'all' && (
          <Button
            variant="link"
            className="mt-2"
            onClick={() => setStatusFilter('all')}
          >
            Show all activity
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      {showFilters && (
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as AutomationLogStatus | 'all');
            setPage(0);
          }}
        >
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="success" className="text-xs">Success</TabsTrigger>
            <TabsTrigger value="failed" className="text-xs">Failed</TabsTrigger>
            <TabsTrigger value="skipped" className="text-xs">Skipped</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Log Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Status</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="w-40">Time</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localLogs.map((log, index) => {
              const config = statusConfig[log.status as AutomationLogStatus];
              const Icon = config.icon;
              const result = log.result as Record<string, unknown> | null;

              return (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  onClick={() => handleRowClick(log)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/50',
                    log.target_type === 'invoice' && 'cursor-pointer'
                  )}
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('gap-1', config.color)}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">
                          {log.target_type === 'invoice' ? 'Invoice' : log.target_type}
                        </span>
                        {result?.invoice_number && (
                          <span className="text-muted-foreground ml-1">
                            #{String(result.invoice_number)}
                          </span>
                        )}
                        {result?.reminder_count && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Reminder #{String(result.reminder_count)})
                          </span>
                        )}
                        {log.status === 'failed' && result?.error && (
                          <p className="text-xs text-destructive mt-0.5 truncate max-w-[200px]">
                            {String(result.error)}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span title={format(new Date(log.created_at), 'PPpp')}>
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    {log.target_type === 'invoice' && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.count > limit && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, data.count)} of {data.count}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= data.count}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
