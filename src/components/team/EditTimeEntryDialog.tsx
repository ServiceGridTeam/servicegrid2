import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useEditTimeEntry, TimeEntry } from "@/hooks/useTimeEntries";
import { useTimeEntryEditHistory } from "@/hooks/useTimeEntryEdits";
import { Clock, Loader2, History } from "lucide-react";

const formSchema = z.object({
  clockIn: z.string().min(1, "Clock in time is required"),
  clockOut: z.string().min(1, "Clock out time is required"),
  notes: z.string().optional(),
  reason: z.string().min(1, "Reason for edit is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface EditTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: TimeEntry | null;
}

function formatDuration(minutes: number): string {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function EditTimeEntryDialog({
  open,
  onOpenChange,
  entry,
}: EditTimeEntryDialogProps) {
  const { toast } = useToast();
  const editEntry = useEditTimeEntry();
  const { data: editHistory } = useTimeEntryEditHistory(entry?.id);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clockIn: "",
      clockOut: "",
      notes: "",
      reason: "",
    },
  });

  // Reset form when entry changes
  useEffect(() => {
    if (entry) {
      form.reset({
        clockIn: format(new Date(entry.clock_in), "HH:mm"),
        clockOut: entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : "",
        notes: entry.notes || "",
        reason: "",
      });
    }
  }, [entry, form]);

  const watchClockIn = form.watch("clockIn");
  const watchClockOut = form.watch("clockOut");

  // Calculate new duration
  let newDurationMinutes = 0;
  if (entry && watchClockIn && watchClockOut) {
    const entryDate = new Date(entry.clock_in);
    const [inHours, inMinutes] = watchClockIn.split(":").map(Number);
    const [outHours, outMinutes] = watchClockOut.split(":").map(Number);
    
    const clockInDate = new Date(entryDate);
    clockInDate.setHours(inHours, inMinutes, 0, 0);
    
    const clockOutDate = new Date(entryDate);
    clockOutDate.setHours(outHours, outMinutes, 0, 0);
    
    if (clockOutDate < clockInDate) {
      clockOutDate.setDate(clockOutDate.getDate() + 1);
    }
    
    newDurationMinutes = Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
  }

  const onSubmit = async (values: FormValues) => {
    if (!entry) return;
    
    try {
      const entryDate = new Date(entry.clock_in);
      const [inHours, inMinutes] = values.clockIn.split(":").map(Number);
      const [outHours, outMinutes] = values.clockOut.split(":").map(Number);
      
      const clockInDate = new Date(entryDate);
      clockInDate.setHours(inHours, inMinutes, 0, 0);
      
      const clockOutDate = new Date(entryDate);
      clockOutDate.setHours(outHours, outMinutes, 0, 0);
      
      if (clockOutDate < clockInDate) {
        clockOutDate.setDate(clockOutDate.getDate() + 1);
      }

      await editEntry.mutateAsync({
        id: entry.id,
        clockIn: clockInDate.toISOString(),
        clockOut: clockOutDate.toISOString(),
        notes: values.notes,
        reason: values.reason,
      });

      toast({
        title: "Time entry updated",
        description: "Changes have been saved and logged.",
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!entry) return null;

  const originalClockIn = format(new Date(entry.clock_in), "h:mm a");
  const originalClockOut = entry.clock_out ? format(new Date(entry.clock_out), "h:mm a") : "Active";
  const originalDuration = entry.duration_minutes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
          <DialogDescription>
            Make changes to this time entry. All edits are logged for audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entry Info */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium">Date: {format(new Date(entry.clock_in), "MMMM d, yyyy")}</p>
            {entry.is_manual && (
              <Badge variant="outline" className="text-xs">Manual Entry</Badge>
            )}
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Original</p>
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p>Time In: {originalClockIn}</p>
                <p>Time Out: {originalClockOut}</p>
                <p>Duration: {formatDuration(originalDuration || 0)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Updated</p>
              <Form {...form}>
                <div className="rounded-lg border p-3 space-y-2">
                  <FormField
                    control={form.control}
                    name="clockIn"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Time In</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                            <Input type="time" className="pl-7 h-8 text-sm" {...field} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clockOut"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-xs">Time Out</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                            <Input type="time" className="pl-7 h-8 text-sm" {...field} />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <p className="text-sm pt-1">
                    Duration: <span className="font-medium">{formatDuration(newDurationMinutes)}</span>
                  </p>
                </div>
              </Form>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for edit *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., GPS showed arrival at 7:45, clock-in was delayed"
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Edit History */}
              {editHistory && editHistory.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Edit History</span>
                  </div>
                  <ScrollArea className="h-[100px] rounded-md border p-2">
                    <div className="space-y-2 text-sm">
                      {editHistory.map((edit) => (
                        <div key={edit.id} className="text-muted-foreground">
                          <span className="text-foreground">
                            {format(new Date(edit.created_at), "MMM d, h:mm a")}
                          </span>
                          {" - "}
                          {edit.editor?.first_name} {edit.editor?.last_name}
                          {edit.edit_reason && (
                            <span className="block text-xs ml-4 italic">"{edit.edit_reason}"</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editEntry.isPending}>
                  {editEntry.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
