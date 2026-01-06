import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useCreateManualTimeEntry } from "@/hooks/useTimeEntries";
import { useJobs } from "@/hooks/useJobs";
import { useActiveBreakRules, calculateBreakDeduction } from "@/hooks/useBreakRules";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";

const formSchema = z.object({
  jobId: z.string().min(1, "Job is required"),
  date: z.date({ required_error: "Date is required" }),
  clockIn: z.string().min(1, "Clock in time is required"),
  clockOut: z.string().min(1, "Clock out time is required"),
  entryType: z.enum(["work", "travel", "break"]).default("work"),
  notes: z.string().optional(),
  reason: z.string().min(1, "Reason for manual entry is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface ManualTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultJobId?: string;
  defaultDate?: Date;
}

function calculateDuration(date: Date, clockIn: string, clockOut: string): number {
  const [inHours, inMinutes] = clockIn.split(":").map(Number);
  const [outHours, outMinutes] = clockOut.split(":").map(Number);
  
  const clockInDate = new Date(date);
  clockInDate.setHours(inHours, inMinutes, 0, 0);
  
  const clockOutDate = new Date(date);
  clockOutDate.setHours(outHours, outMinutes, 0, 0);
  
  // Handle overnight shifts
  if (clockOutDate < clockInDate) {
    clockOutDate.setDate(clockOutDate.getDate() + 1);
  }
  
  return Math.floor((clockOutDate.getTime() - clockInDate.getTime()) / 60000);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

export function ManualTimeEntryDialog({
  open,
  onOpenChange,
  defaultJobId,
  defaultDate,
}: ManualTimeEntryDialogProps) {
  const { toast } = useToast();
  const { data: jobs, isLoading: jobsLoading } = useJobs();
  const { data: breakRules } = useActiveBreakRules();
  const createEntry = useCreateManualTimeEntry();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobId: defaultJobId || "",
      date: defaultDate || new Date(),
      clockIn: "08:00",
      clockOut: "17:00",
      entryType: "work",
      notes: "",
      reason: "",
    },
  });

  const watchDate = form.watch("date");
  const watchClockIn = form.watch("clockIn");
  const watchClockOut = form.watch("clockOut");

  // Calculate duration and break deduction
  let durationMinutes = 0;
  let breakDeduction = 0;
  let netDuration = 0;
  
  if (watchDate && watchClockIn && watchClockOut) {
    durationMinutes = calculateDuration(watchDate, watchClockIn, watchClockOut);
    if (breakRules && breakRules.length > 0) {
      const { totalDeductionMinutes } = calculateBreakDeduction(durationMinutes, breakRules);
      breakDeduction = totalDeductionMinutes;
    }
    netDuration = Math.max(0, durationMinutes - breakDeduction);
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const [inHours, inMinutes] = values.clockIn.split(":").map(Number);
      const [outHours, outMinutes] = values.clockOut.split(":").map(Number);
      
      const clockInDate = new Date(values.date);
      clockInDate.setHours(inHours, inMinutes, 0, 0);
      
      const clockOutDate = new Date(values.date);
      clockOutDate.setHours(outHours, outMinutes, 0, 0);
      
      // Handle overnight
      if (clockOutDate < clockInDate) {
        clockOutDate.setDate(clockOutDate.getDate() + 1);
      }

      await createEntry.mutateAsync({
        jobId: values.jobId,
        clockIn: clockInDate.toISOString(),
        clockOut: clockOutDate.toISOString(),
        entryType: values.entryType,
        notes: values.notes,
        reason: values.reason,
      });

      toast({
        title: "Time entry created",
        description: "Manual time entry has been added successfully.",
      });
      
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create time entry. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Time Entry</DialogTitle>
          <DialogDescription>
            Create a time entry manually. A reason is required for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="jobId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {jobsLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        jobs?.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.job_number} - {job.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(field.value, "PPP") : "Pick a date"}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clockIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clock In</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="time" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clockOut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clock Out</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="time" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {durationMinutes > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">
                  Duration: {formatDuration(durationMinutes)}
                  {breakDeduction > 0 && (
                    <span className="text-muted-foreground ml-2">
                      ({formatDuration(breakDeduction)} break deducted → {formatDuration(netDuration)} net)
                    </span>
                  )}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="entryType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="work">Work</SelectItem>
                      <SelectItem value="travel">Travel</SelectItem>
                      <SelectItem value="break">Break</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for manual entry *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Forgot to clock in - was at job site on time"
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createEntry.isPending}>
                {createEntry.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Entry
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
