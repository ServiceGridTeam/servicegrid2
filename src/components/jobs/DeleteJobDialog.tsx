import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteJob } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";

interface DeleteJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobNumber: string;
  onSuccess?: () => void;
}

export function DeleteJobDialog({
  open,
  onOpenChange,
  jobId,
  jobNumber,
  onSuccess,
}: DeleteJobDialogProps) {
  const { toast } = useToast();
  const deleteJob = useDeleteJob();

  const handleDelete = async () => {
    try {
      await deleteJob.mutateAsync(jobId);
      toast({
        title: "Job deleted",
        description: `${jobNumber} has been deleted.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Job</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {jobNumber}? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteJob.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
