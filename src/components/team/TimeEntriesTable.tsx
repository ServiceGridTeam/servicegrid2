import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTimeEntriesForJob, useDeleteTimeEntry, TimeEntry } from "@/hooks/useTimeEntries";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Trash2, MapPin } from "lucide-react";

interface TimeEntriesTableProps {
  jobId: string;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "?";
}

export function TimeEntriesTable({ jobId }: TimeEntriesTableProps) {
  const { toast } = useToast();
  const { data: entries, isLoading } = useTimeEntriesForJob(jobId);
  const deleteEntry = useDeleteTimeEntry();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteEntry.mutateAsync(deleteId);
      toast({
        title: "Entry deleted",
        description: "Time entry has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete time entry.",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No time entries recorded yet
      </p>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>GPS</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={entry.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(entry.user?.first_name || null, entry.user?.last_name || null)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {entry.user?.first_name} {entry.user?.last_name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(entry.clock_in), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(entry.clock_in), "h:mm a")}
                  {entry.clock_out && (
                    <> - {format(new Date(entry.clock_out), "h:mm a")}</>
                  )}
                  {!entry.clock_out && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Active
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {formatDuration(entry.duration_minutes)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    {entry.clock_in_latitude && entry.clock_in_longitude ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-green-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p>Clock In: {Number(entry.clock_in_latitude).toFixed(6)}, {Number(entry.clock_in_longitude).toFixed(6)}</p>
                            {entry.clock_out_latitude && entry.clock_out_longitude && (
                              <p>Clock Out: {Number(entry.clock_out_latitude).toFixed(6)}, {Number(entry.clock_out_longitude).toFixed(6)}</p>
                            )}
                            {entry.location_accuracy && (
                              <p className="text-muted-foreground">Accuracy: ±{Math.round(Number(entry.location_accuracy))}m</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this time entry? This action cannot be undone.
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
    </>
  );
}
