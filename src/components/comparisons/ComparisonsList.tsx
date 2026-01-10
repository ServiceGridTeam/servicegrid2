/**
 * Comparisons List - Display before/after comparisons for a job
 * Integrates into JobDetailSheet
 */

import { useState } from 'react';
import { Plus, Share, Trash2, Eye, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BeforeAfterComparison } from './BeforeAfterComparison';
import { ComparisonBuilder } from './ComparisonBuilder';
import { ShareComparisonDialog } from './ShareComparisonDialog';
import { useComparisons, useDeleteComparison } from '@/hooks/useComparisons';
import { ComparisonDisplayMode, ComparisonWithMedia } from '@/types/annotations';
import { format } from 'date-fns';
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

interface ComparisonsListProps {
  jobId: string;
}

export function ComparisonsList({ jobId }: ComparisonsListProps) {
  const { data: comparisons = [], isLoading } = useComparisons(jobId);
  const deleteComparison = useDeleteComparison();
  
  const [builderOpen, setBuilderOpen] = useState(false);
  const [shareDialogComparison, setShareDialogComparison] = useState<ComparisonWithMedia | null>(null);
  const [deleteConfirmComparison, setDeleteConfirmComparison] = useState<ComparisonWithMedia | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteConfirmComparison) return;
    
    await deleteComparison.mutateAsync({
      comparisonId: deleteConfirmComparison.id,
      jobId,
    });
    
    setDeleteConfirmComparison(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {comparisons.length} Comparison{comparisons.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button size="sm" onClick={() => setBuilderOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Create
        </Button>
      </div>

      {/* Empty State */}
      {comparisons.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No comparisons yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Create before & after comparisons to share with customers
            </p>
            <Button 
              size="sm" 
              className="mt-4" 
              onClick={() => setBuilderOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Comparison
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Comparisons List */}
      <div className="space-y-3">
        {comparisons.map((comparison) => {
          const beforeUrl = comparison.before_media?.thumbnail_url_lg || comparison.before_media?.url;
          const afterUrl = comparison.after_media?.thumbnail_url_lg || comparison.after_media?.url;
          const isExpanded = expandedId === comparison.id;

          if (!beforeUrl || !afterUrl) return null;

          return (
            <Card key={comparison.id} className="overflow-hidden">
              <CardContent className="p-3">
                {/* Comparison Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium truncate">
                      {comparison.title || 'Before & After'}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comparison.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {comparison.is_public && (
                      <Badge variant="secondary" className="text-xs">
                        Shared
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setExpandedId(isExpanded ? null : comparison.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setShareDialogComparison(comparison)}
                    >
                      <Share className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteConfirmComparison(comparison)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Thumbnail Preview */}
                {!isExpanded && (
                  <div 
                    className="flex gap-2 cursor-pointer"
                    onClick={() => setExpandedId(comparison.id)}
                  >
                    <div className="relative flex-1 aspect-video rounded overflow-hidden bg-muted">
                      <img 
                        src={beforeUrl} 
                        alt="Before" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-1 left-1 text-[10px] px-1 py-0"
                      >
                        Before
                      </Badge>
                    </div>
                    <div className="relative flex-1 aspect-video rounded overflow-hidden bg-muted">
                      <img 
                        src={afterUrl} 
                        alt="After" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-1 left-1 text-[10px] px-1 py-0"
                      >
                        After
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Expanded Full Comparison */}
                {isExpanded && (
                  <div className="mt-2">
                    <BeforeAfterComparison
                      beforeUrl={beforeUrl}
                      afterUrl={afterUrl}
                      displayMode={(comparison.display_mode as ComparisonDisplayMode) || 'slider'}
                      showModeToggle
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Builder Dialog */}
      <ComparisonBuilder
        jobId={jobId}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
      />

      {/* Share Dialog */}
      {shareDialogComparison && (
        <ShareComparisonDialog
          comparison={shareDialogComparison}
          open={!!shareDialogComparison}
          onOpenChange={(open) => !open && setShareDialogComparison(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog 
        open={!!deleteConfirmComparison} 
        onOpenChange={(open) => !open && setDeleteConfirmComparison(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comparison?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this before & after comparison.
              {deleteConfirmComparison?.is_public && (
                <span className="block mt-2 text-destructive">
                  This comparison has an active share link that will stop working.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
