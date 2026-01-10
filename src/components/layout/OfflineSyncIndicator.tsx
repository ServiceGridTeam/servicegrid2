import { useState, useEffect } from "react";
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "error";

interface OfflineSyncIndicatorProps {
  className?: string;
}

export function OfflineSyncIndicator({ className }: OfflineSyncIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>("synced");
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus((prev) => (prev === "offline" ? "synced" : prev));
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
    const handleQueueUpdate = (e: CustomEvent<{ pending: number; status: SyncStatus }>) => {
      setPendingCount(e.detail.pending);
      setStatus(e.detail.status);
    };

    window.addEventListener("upload-queue-update" as any, handleQueueUpdate);
    return () => {
      window.removeEventListener("upload-queue-update" as any, handleQueueUpdate);
    };
  }, []);

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
