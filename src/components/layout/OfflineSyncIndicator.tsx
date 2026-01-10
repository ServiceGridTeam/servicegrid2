import { useState, useEffect, useCallback } from "react";
import { Cloud, CloudOff, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  getQueueStatus, 
  retryFailedItems,
  clearFailedItems,
  dispatchQueueUpdate 
} from "@/lib/indexedDbQueue";

type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "error";

interface OfflineSyncIndicatorProps {
  className?: string;
}

export function OfflineSyncIndicator({ className }: OfflineSyncIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load initial queue status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const queueStatus = await getQueueStatus();
        setPendingCount(queueStatus.pendingCount + queueStatus.uploadingCount);
        setFailedCount(queueStatus.failedCount);
        
        if (!navigator.onLine) {
          setStatus("offline");
        } else if (queueStatus.uploadingCount > 0) {
          setStatus("syncing");
        } else if (queueStatus.failedCount > 0) {
          setStatus("error");
        } else if (queueStatus.pendingCount > 0) {
          setStatus("pending");
        } else {
          setStatus("synced");
        }
      } catch (err) {
        console.error("Failed to load queue status:", err);
      }
    };
    
    loadStatus();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus((prev) => (prev === "offline" ? "pending" : prev));
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen for custom upload queue events
  useEffect(() => {
    const handleQueueUpdate = (e: CustomEvent<{ pending: number; status: SyncStatus; failed?: number }>) => {
      setPendingCount(e.detail.pending);
      setStatus(e.detail.status);
      if (e.detail.failed !== undefined) {
        setFailedCount(e.detail.failed);
      }
    };

    window.addEventListener("upload-queue-update" as any, handleQueueUpdate);
    return () => {
      window.removeEventListener("upload-queue-update" as any, handleQueueUpdate);
    };
  }, []);

  const handleRetryFailed = useCallback(async () => {
    await retryFailedItems();
    setFailedCount(0);
    setStatus("pending");
    // Trigger queue processing by dispatching update
    dispatchQueueUpdate({ pending: pendingCount, status: "pending" });
  }, [pendingCount]);

  const getStatusConfig = () => {
    switch (status) {
      case "synced":
        return {
          icon: Check,
          color: "text-green-500",
          bgColor: "bg-green-500/10",
          label: "All synced",
        };
      case "syncing":
        return {
          icon: Loader2,
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          label: `Uploading ${pendingCount} item${pendingCount !== 1 ? "s" : ""}...`,
          animate: true,
        };
      case "pending":
        return {
          icon: Cloud,
          color: "text-yellow-500",
          bgColor: "bg-yellow-500/10",
          label: `${pendingCount} item${pendingCount !== 1 ? "s" : ""} waiting to sync`,
        };
      case "offline":
        return {
          icon: CloudOff,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          label: "Offline - items will sync when online",
        };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          label: "Some uploads failed",
        };
      default:
        return {
          icon: Cloud,
          color: "text-muted-foreground",
          bgColor: "bg-muted",
          label: "Unknown status",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  // Don't show if synced and online
  if (status === "synced" && isOnline) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative flex items-center justify-center h-8 w-8 rounded-md cursor-default",
              config.bgColor,
              className
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                config.color,
                config.animate && "animate-spin"
              )}
            />
            {pendingCount > 0 && status !== "synced" && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-[16px] rounded-full px-1 text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
