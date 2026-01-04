import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, setHours, setMinutes } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { MultiAssigneeSelector } from "./MultiAssigneeSelector";
import { useCreateJob, useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { useUpdateJobAssignments } from "@/hooks/useJobAssignments";
import { useCustomer } from "@/hooks/useCustomers";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/hooks/use-toast";

const jobFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  title: z.string().optional(),
  scheduled_date: z.date().optional(),
  scheduled_time: z.string().optional(),
  duration: z.string().optional(),
  assigned_to: z.array(z.string()).default([]),
  priority: z.string().default("normal"),
  status: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: JobWithCustomer | null;
  defaultCustomerId?: string;
  defaultDate?: Date;
  quoteId?: string;
  onSuccess?: () => void;
}

const durations = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "1.5 hours" },
  { value: "120", label: "2 hours" },
  { value: "180", label: "3 hours" },
  { value: "240", label: "4 hours" },
  { value: "480", label: "Full day (8 hours)" },
];

const timeSlots = Array.from({ length: 24 }, (_, i) => {
  const hour = i;
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return [
    { value: `${hour.toString().padStart(2, "0")}:00`, label: `${displayHour}:00 ${ampm}` },
    { value: `${hour.toString().padStart(2, "0")}:30`, label: `${displayHour}:30 ${ampm}` },
  ];
}).flat();

export function JobFormDialog({
  open,
  onOpenChange,
  job,
  defaultCustomerId,
  defaultDate,
  quoteId,
  onSuccess,
}: JobFormDialogProps) {
  const { toast } = useToast();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const updateAssignments = useUpdateJobAssignments();
  const { data: business } = useBusiness();
  const isEditing = !!job;

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      customer_id: "",
      title: "",
      priority: "normal",
      status: "scheduled",
      address_line1: "",
      address_line2: "",
      city: "",
      state: "",
      zip: "",
      notes: "",
      internal_notes: "",
      duration: "60",
      scheduled_time: "09:00",
    },
  });

  const selectedCustomerId = form.watch("customer_id");
  const { data: customer } = useCustomer(selectedCustomerId || undefined);

  // Populate form when editing
  useEffect(() => {
    if (job) {
      const scheduledDate = job.scheduled_start
        ? new Date(job.scheduled_start)
        : undefined;
      const scheduledTime = scheduledDate
        ? format(scheduledDate, "HH:mm")
        : "09:00";

      let duration = "60";
      if (job.scheduled_start && job.scheduled_end) {
        const start = new Date(job.scheduled_start);
        const end = new Date(job.scheduled_end);
        const diffMinutes = (end.getTime() - start.getTime()) / 60000;
        const closestDuration = durations.reduce((prev, curr) =>
          Math.abs(parseInt(curr.value) - diffMinutes) <
          Math.abs(parseInt(prev.value) - diffMinutes)
            ? curr
            : prev
        );
        duration = closestDuration.value;
      }

      // Get assigned user IDs from assignments or fall back to assigned_to
      const assignedUserIds = job.assignments && job.assignments.length > 0
        ? job.assignments.map(a => a.user_id)
        : job.assigned_to 
          ? [job.assigned_to]
          : [];

      form.reset({
        customer_id: job.customer_id,
        title: job.title || "",
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        duration,
        assigned_to: assignedUserIds,
        priority: job.priority || "normal",
        status: job.status || "scheduled",
        address_line1: job.address_line1 || "",
        address_line2: job.address_line2 || "",
        city: job.city || "",
        state: job.state || "",
        zip: job.zip || "",
        notes: job.notes || "",
        internal_notes: job.internal_notes || "",
      });
    } else {
      form.reset({
        customer_id: defaultCustomerId || "",
        title: "",
        scheduled_date: defaultDate,
        scheduled_time: "09:00",
        duration: "60",
        assigned_to: [],
        priority: "normal",
        status: "scheduled",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        zip: "",
        notes: "",
        internal_notes: "",
      });
    }
  }, [job, defaultCustomerId, defaultDate, form]);

  // Auto-fill address from customer
  useEffect(() => {
    if (customer && !isEditing) {
      form.setValue("address_line1", customer.address_line1 || "");
      form.setValue("address_line2", customer.address_line2 || "");
      form.setValue("city", customer.city || "");
      form.setValue("state", customer.state || "");
      form.setValue("zip", customer.zip || "");
    }
  }, [customer, isEditing, form]);

  const onSubmit = async (values: JobFormValues) => {
    try {
      let scheduled_start: string | null = null;
      let scheduled_end: string | null = null;

      if (values.scheduled_date && values.scheduled_time) {
        const [hours, minutes] = values.scheduled_time.split(":").map(Number);
        const startDate = setMinutes(setHours(values.scheduled_date, hours), minutes);
        scheduled_start = startDate.toISOString();

        if (values.duration) {
          const endDate = new Date(startDate.getTime() + parseInt(values.duration) * 60000);
          scheduled_end = endDate.toISOString();
        }
      }

      // First user in list is the lead/primary assignee
      const primaryAssignee = values.assigned_to.length > 0 ? values.assigned_to[0] : null;

      const jobData = {
        customer_id: values.customer_id,
        title: values.title || "",
        scheduled_start,
        scheduled_end,
        assigned_to: primaryAssignee,
        priority: values.priority,
        status: values.status,
        address_line1: values.address_line1 || null,
        address_line2: values.address_line2 || null,
        city: values.city || null,
        state: values.state || null,
        zip: values.zip || null,
        notes: values.notes || null,
        internal_notes: values.internal_notes || null,
        quote_id: quoteId || null,
      };

      let jobId: string;

      if (isEditing) {
        await updateJob.mutateAsync({ id: job.id, ...jobData });
        jobId = job.id;
        toast({
          title: "Job updated",
          description: "The job has been updated successfully.",
        });
      } else {
        const newJob = await createJob.mutateAsync(jobData);
        jobId = newJob.id;
        toast({
          title: "Job created",
          description: "The job has been scheduled successfully.",
        });
      }

      // Update job assignments
      if (business) {
        await updateAssignments.mutateAsync({
          jobId,
          userIds: values.assigned_to,
          businessId: business.id,
        });
      }

      onOpenChange(false);
      onSuccess?.();

      if (isEditing) {
        await updateJob.mutateAsync({ id: job.id, ...jobData });
        toast({
          title: "Job updated",
          description: "The job has been updated successfully.",
        });
      } else {
        await createJob.mutateAsync(jobData);
        toast({
          title: "Job created",
          description: "The job has been scheduled successfully.",
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} job. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Job" : "Schedule New Job"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <FormControl>
                    <CustomerSelector
                      value={field.value}
                      onValueChange={(id) => field.onChange(id)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Spring Cleanup" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
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
                            {field.value ? (
                              format(field.value, "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px]">
                        {timeSlots.map((slot) => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {durations.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Assign Team Members</FormLabel>
                    <FormControl>
                      <MultiAssigneeSelector
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isEditing && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Job Location</h3>
              <FormField
                control={form.control}
                name="address_line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_line2"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Apt, Suite, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-6 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>ZIP</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes about the job..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internal_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Internal team notes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createJob.isPending || updateJob.isPending}
              >
                {createJob.isPending || updateJob.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Job"
                  : "Schedule Job"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
