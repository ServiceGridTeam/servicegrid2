/**
 * Annotation History Panel - Version management for annotations
 * Part of Field Photo Documentation System
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  X, 
  History, 
  RotateCcw, 
  ChevronRight,
  Plus,
  Minus,
  User,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAnnotationHistory, useRevertAnnotation } from '@/hooks/useAnnotations';
import type { MediaAnnotation, AnnotationData } from '@/types/annotations';

interface AnnotationHistoryPanelProps {
  mediaId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreviewVersion?: (data: AnnotationData) => void;
  currentVersion?: number;
}

export function AnnotationHistoryPanel({
  mediaId,
  open,
  onOpenChange,
  onPreviewVersion,
  currentVersion,
}: AnnotationHistoryPanelProps) {
  const { data: history = [], isLoading } = useAnnotationHistory(mediaId);
  const revertMutation = useRevertAnnotation();
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const handlePreview = (annotation: MediaAnnotation) => {
    setPreviewingId(annotation.id);
    onPreviewVersion?.(annotation.annotation_data);
  };

  const handleRevert = async (annotation: MediaAnnotation) => {
    await revertMutation.mutateAsync({
      mediaId,
      versionId: annotation.id,
    });
    onOpenChange(false);
  };

  // Calculate diff between versions
  const getDiff = (current: MediaAnnotation, previous?: MediaAnnotation) => {
    const currentCount = current.object_count;
    const previousCount = previous?.object_count ?? 0;
    const diff = currentCount - previousCount;
    return diff;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ 
              type: 'spring',
              damping: 30,
              stiffness: 400,
              mass: 0.8,
            }}
            className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">Version History</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No version history yet</p>
                  <p className="text-xs mt-1">Save annotations to create versions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((annotation, index) => {
                    const previousAnnotation = history[index + 1];
                    const diff = getDiff(annotation, previousAnnotation);
                    const isCurrentVersion = annotation.version === currentVersion;
                    const isPreviewing = previewingId === annotation.id;

                    return (
                      <motion.div
                        key={annotation.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
                          isCurrentVersion && "border-primary bg-primary/5",
                          isPreviewing && "ring-2 ring-primary"
                        )}
                        onClick={() => handlePreview(annotation)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback className="bg-muted text-xs">
                                {annotation.created_by_name?.charAt(0) || <User className="h-4 w-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  v{annotation.version}
                                </span>
                                {isCurrentVersion && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {annotation.created_by_name || 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(annotation.created_at), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1">
                            {/* Object count */}
                            <span className="text-xs text-muted-foreground">
                              {annotation.object_count} objects
                            </span>
                            
                            {/* Diff indicator */}
                            {diff !== 0 && (
                              <div className={cn(
                                "flex items-center gap-0.5 text-xs",
                                diff > 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {diff > 0 ? (
                                  <Plus className="h-3 w-3" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                                {Math.abs(diff)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Feature indicators */}
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {annotation.has_arrows && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Arrows
                            </Badge>
                          )}
                          {annotation.has_text && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Text
                            </Badge>
                          )}
                          {annotation.has_shapes && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Shapes
                            </Badge>
                          )}
                          {annotation.has_measurements && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              Measurements
                            </Badge>
                          )}
                        </div>

                        {/* Restore button */}
                        {!isCurrentVersion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevert(annotation);
                            }}
                            disabled={revertMutation.isPending}
                          >
                            {revertMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            Restore this version
                          </Button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer hint */}
            <div className="p-3 border-t bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">
                Click a version to preview • Restore to create a new version
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
