import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, X, RefreshCw, Cloud, CloudOff, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QueuedUpload, getQueuedItemsByJob, removeFromQueue, getQueueStatus } from "@/lib/indexedDbQueue";

interface PhotoUploadProgressProps {
  jobId: string;
  onRetryFailed?: () => void;
}

export function PhotoUploadProgress({ jobId, onRetryFailed }: PhotoUploadProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [queuedItems, setQueuedItems] = useState<QueuedUpload[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Load queued items for this job
  useEffect(() => {
    const loadItems = async () => {
      const items = await getQueuedItemsByJob(jobId);
      setQueuedItems(items);
    };
    
    loadItems();
    
    // Poll for updates
    const interval = setInterval(loadItems, 500);
    return () => clearInterval(interval);
  }, [jobId]);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Track completed items for animation
  useEffect(() => {
    const handleQueueUpdate = async () => {
      const status = await getQueueStatus();
      // When an item completes, show the checkmark animation
      const currentItems = await getQueuedItemsByJob(jobId);
      const currentIds = new Set(currentItems.map(i => i.id));
      
      // Find items that were removed (completed)
      queuedItems.forEach(item => {
        if (!currentIds.has(item.id) && item.status === 'uploading') {
          setCompletedIds(prev => new Set([...prev, item.id]));
          // Remove from completed set after animation
          setTimeout(() => {
            setCompletedIds(prev => {
              const next = new Set(prev);
              next.delete(item.id);
              return next;
            });
          }, 1000);
        }
      });
    };
    
    window.addEventListener('upload-queue-update', handleQueueUpdate);
    return () => window.removeEventListener('upload-queue-update', handleQueueUpdate);
  }, [jobId, queuedItems]);

  const handleCancelUpload = async (id: string) => {
    await removeFromQueue(id);
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  };

  const pendingCount = queuedItems.filter(i => i.status === 'pending').length;
  const uploadingCount = queuedItems.filter(i => i.status === 'uploading').length;
  const failedCount = queuedItems.filter(i => i.status === 'failed').length;
  const totalActive = pendingCount + uploadingCount;

  // Don't show if no items
  if (queuedItems.length === 0 && completedIds.size === 0) {
    return null;
  }

  const statusText = () => {
    if (!isOnline) {
      return `${totalActive} photo${totalActive !== 1 ? 's' : ''} queued offline`;
    }
    if (uploadingCount > 0) {
      return `Uploading ${uploadingCount} of ${totalActive}...`;
    }
    if (pendingCount > 0) {
      return `${pendingCount} photo${pendingCount !== 1 ? 's' : ''} pending`;
    }
    if (failedCount > 0) {
      return `${failedCount} failed`;
    }
    return 'All uploads complete';
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 sm:rounded-t-xl sm:border sm:rounded-xl"
    >
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Status icon */}
          {!isOnline ? (
            <CloudOff className="h-5 w-5 text-muted-foreground" />
          ) : uploadingCount > 0 ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : failedCount > 0 ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : totalActive === 0 ? (
            <Check className="h-5 w-5 text-green-500" />
          ) : (
            <Cloud className="h-5 w-5 text-muted-foreground" />
          )}
          
          <span className="text-sm font-medium">{statusText()}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {failedCount > 0 && onRetryFailed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onRetryFailed();
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && queuedItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Thumbnail grid */}
              <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {queuedItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                      className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                    >
                      {/* Thumbnail image */}
                      {item.localPreviewUrl && (
                        <img
                          src={item.localPreviewUrl}
                          alt="Upload preview"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Uploading overlay with shimmer */}
                      {item.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/30">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                          </div>
                        </div>
                      )}

                      {/* Pending overlay */}
                      {item.status === 'pending' && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Cloud className="h-4 w-4 text-white/80" />
                        </div>
                      )}

                      {/* Failed overlay */}
                      {item.status === 'failed' && (
                        <div className="absolute inset-0 bg-destructive/30 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-white" />
                        </div>
                      )}

                      {/* Cancel button - visible on hover for pending/uploading */}
                      {(item.status === 'pending' || item.status === 'uploading') && (
                        <button
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelUpload(item.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Offline indicator */}
              {!isOnline && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <CloudOff className="h-3.5 w-3.5" />
                  <span>Photos will upload when you're back online</span>
                </div>
              )}

              {/* Failed items action */}
              {failedCount > 0 && onRetryFailed && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full gap-2"
                  onClick={onRetryFailed}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry {failedCount} Failed Upload{failedCount !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
