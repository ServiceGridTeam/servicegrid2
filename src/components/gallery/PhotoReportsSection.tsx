/**
 * Photo Reports Section
 * Collapsible section for managing photo reports in job detail sheet
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { usePhotoReports } from '@/hooks/usePhotoReports';
import { PhotoReportDialog } from './PhotoReportDialog';
import { PhotoReportCard } from './PhotoReportCard';

interface PhotoReportsSectionProps {
  jobId: string;
}

export function PhotoReportsSection({ jobId }: PhotoReportsSectionProps) {
  const { data: reports, isLoading } = usePhotoReports(jobId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const reportCount = reports?.length || 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="h-4 w-4" />
          <span>Photo Reports</span>
          {reportCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {reportCount}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Generate Report
        </Button>
      </div>

      {/* Content */}
      {expanded && (
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-lg">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No reports generated yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Create a PDF report to share with customers
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <PhotoReportCard key={report.id} report={report} jobId={jobId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog */}
      <PhotoReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobId={jobId}
      />
    </div>
  );
}
