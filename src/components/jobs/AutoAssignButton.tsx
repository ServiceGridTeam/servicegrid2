import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { useAutoAssign, type AutoAssignResult } from "@/hooks/useAutoAssign";
import { AutoAssignDialog } from "./AutoAssignDialog";
import type { JobWithCustomer } from "@/hooks/useJobs";

interface AutoAssignButtonProps {
  job: JobWithCustomer;
  preferredDate?: string;
  variant?: "default" | "compact" | "ghost";
  onAssigned?: (result: AutoAssignResult) => void;
}

export function AutoAssignButton({
  job,
  preferredDate,
  variant = "default",
  onAssigned,
}: AutoAssignButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [result, setResult] = useState<AutoAssignResult | null>(null);
  const autoAssign = useAutoAssign();

  const handleClick = async () => {
    try {
      const response = await autoAssign.mutateAsync({
        jobId: job.id,
        preferredDate,
      });
      setResult(response);
      if (response.success) {
        setDialogOpen(true);
        onAssigned?.(response);
      }
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = autoAssign.isPending;

  if (variant === "compact") {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isLoading}
          className="h-7 px-2 text-xs"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Assigning...
            </>
          ) : (
            <>
              <Wand2 className="h-3 w-3 mr-1" />
              Auto-Assign
            </>
          )}
        </Button>
        <AutoAssignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          result={result}
          job={job}
        />
      </>
    );
  }

  if (variant === "ghost") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          disabled={isLoading}
          className="w-full justify-start"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Finding best worker...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Auto-Assign
            </>
          )}
        </Button>
        <AutoAssignDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          result={result}
          job={job}
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding best worker...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Auto-Assign
          </>
        )}
      </Button>
      <AutoAssignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        result={result}
        job={job}
      />
    </>
  );
}
