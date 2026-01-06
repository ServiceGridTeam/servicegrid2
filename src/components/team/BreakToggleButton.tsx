import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useActiveBreakEntry, useStartBreak, useEndBreak } from "@/hooks/useBreakTracking";
import { useToast } from "@/hooks/use-toast";
import { Coffee, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreakToggleButtonProps {
  jobId: string;
  businessId: string;
  currentWorkEntryId: string;
  variant?: "default" | "compact";
  className?: string;
}

function formatBreakDuration(startTime: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function BreakToggleButton({
  jobId,
  businessId,
  currentWorkEntryId,
  variant = "default",
  className,
}: BreakToggleButtonProps) {
  const { toast } = useToast();
  const { data: activeBreak, isLoading } = useActiveBreakEntry(jobId);
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  
  const [breakDuration, setBreakDuration] = useState<string>("");

  // Update break duration every second when on break
  useEffect(() => {
    if (!activeBreak) {
      setBreakDuration("");
      return;
    }

    const updateDuration = () => {
      setBreakDuration(formatBreakDuration(new Date(activeBreak.clock_in)));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  const handleStartBreak = async () => {
    try {
      await startBreak.mutateAsync({
        jobId,
        businessId,
        currentWorkEntryId,
      });
      toast({
        title: "Break started",
        description: "Your work time has been paused.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start break. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;
    
    try {
      await endBreak.mutateAsync({
        jobId,
        businessId,
        breakEntryId: activeBreak.id,
      });
      toast({
        title: "Break ended",
        description: "Work time tracking resumed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end break. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        size={variant === "compact" ? "sm" : "default"}
        disabled
        className={cn("gap-2", className)}
      >
        <Coffee className="h-4 w-4 animate-pulse" />
      </Button>
    );
  }

  // On break - show End Break button
  if (activeBreak) {
    return (
      <Button
        variant="secondary"
        size={variant === "compact" ? "sm" : "default"}
        onClick={handleEndBreak}
        disabled={endBreak.isPending}
        className={cn("gap-2", className)}
      >
        {endBreak.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4 fill-current" />
        )}
        {variant === "default" ? (
          <>End Break ({breakDuration})</>
        ) : (
          <span className="text-xs">{breakDuration}</span>
        )}
      </Button>
    );
  }

  // Not on break - show Start Break button
  return (
    <Button
      variant="outline"
      size={variant === "compact" ? "sm" : "default"}
      onClick={handleStartBreak}
      disabled={startBreak.isPending}
      className={cn("gap-2", className)}
    >
      {startBreak.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Coffee className="h-4 w-4" />
      )}
      {variant === "default" && "Break"}
    </Button>
  );
}
