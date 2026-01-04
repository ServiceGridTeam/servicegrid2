import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useActiveTimeEntryForJob, useClockIn, useClockOut } from "@/hooks/useTimeEntries";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClockInOutButtonProps {
  jobId: string;
  businessId: string;
  variant?: "default" | "compact";
  className?: string;
}

function formatDuration(startTime: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

export function ClockInOutButton({ 
  jobId, 
  businessId, 
  variant = "default",
  className 
}: ClockInOutButtonProps) {
  const { toast } = useToast();
  const { data: activeEntry, isLoading } = useActiveTimeEntryForJob(jobId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const [duration, setDuration] = useState<string>("");

  // Update duration every second when clocked in
  useEffect(() => {
    if (!activeEntry) {
      setDuration("");
      return;
    }

    const updateDuration = () => {
      setDuration(formatDuration(new Date(activeEntry.clock_in)));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({ jobId, businessId });
      toast({
        title: "Clocked in",
        description: "Time tracking started for this job.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock in. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    
    try {
      await clockOut.mutateAsync({ entryId: activeEntry.id });
      toast({
        title: "Clocked out",
        description: "Time tracking stopped.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" size={variant === "compact" ? "sm" : "default"} disabled className={className}>
        <Clock className="h-4 w-4 animate-pulse" />
        {variant === "default" && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (activeEntry) {
    return (
      <Button
        variant="destructive"
        size={variant === "compact" ? "sm" : "default"}
        onClick={handleClockOut}
        disabled={clockOut.isPending}
        className={cn("gap-2", className)}
      >
        <Square className="h-4 w-4 fill-current" />
        {variant === "default" ? (
          <>Clock Out ({duration})</>
        ) : (
          <span className="text-xs">{duration}</span>
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size={variant === "compact" ? "sm" : "default"}
      onClick={handleClockIn}
      disabled={clockIn.isPending}
      className={cn("gap-2", className)}
    >
      <Play className="h-4 w-4 fill-current" />
      {variant === "default" && "Clock In"}
    </Button>
  );
}
