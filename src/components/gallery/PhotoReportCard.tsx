/**
 * Photo Report Card
 * Display individual report with status and actions
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Download,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useReportStatus, useDeleteReport, type PhotoReport } from '@/hooks/usePhotoReports';

interface PhotoReportCardProps {
  report: PhotoReport;
  jobId: string;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoReportCard({ report, jobId }: PhotoReportCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteReport = useDeleteReport();

  // Poll for status updates if pending/generating
  const shouldPoll = report.status === 'pending' || report.status === 'generating';
  const { data: liveStatus } = useReportStatus(report.id, shouldPoll);

  // Use live status if available, otherwise fall back to prop
  const status = liveStatus?.status || report.status;
  const fileUrl = liveStatus?.file_url || report.file_url;
  const pageCount = liveStatus?.page_count || report.page_count;
  const errorMessage = liveStatus?.error_message || report.error_message;

  const handleDelete = async () => {
    try {
      await deleteReport.mutateAsync({ reportId: report.id, jobId });
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'pending':
      case 'queued':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Queued
          </Badge>
        );
      case 'generating':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Generating
          </Badge>
        );
      case 'ready':
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary">
            Expired
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isReady = status === 'ready' || status === 'completed';
  const isFailed = status === 'failed';
  const isProcessing = status === 'pending' || status === 'generating' || status === 'queued';

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`p-2 rounded-lg ${
                isReady ? 'bg-green-500/10' : 
                isFailed ? 'bg-destructive/10' : 
                'bg-muted'
              }`}>
                <FileText className={`h-4 w-4 ${
                  isReady ? 'text-green-600' : 
                  isFailed ? 'text-destructive' : 
                  'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{report.title}</span>
                  {getStatusBadge()}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    Created {report.created_at 
                      ? formatDistanceToNow(new Date(report.created_at), { addSuffix: true })
                      : 'recently'}
                  </p>
                  {isReady && (
                    <p className="flex items-center gap-2">
                      {pageCount && <span>{pageCount} pages</span>}
                      {report.file_size_bytes && (
                        <span>• {formatFileSize(report.file_size_bytes)}</span>
                      )}
                    </p>
                  )}
                  {isFailed && errorMessage && (
                    <p className="text-destructive">{errorMessage}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isReady && fileUrl && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleDownload}
                    title="Download PDF"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(fileUrl, '_blank')}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </>
              )}
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                  title="Delete report"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{report.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReport.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
