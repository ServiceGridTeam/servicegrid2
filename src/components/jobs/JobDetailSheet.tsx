import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobPriorityBadge } from "./JobPriorityBadge";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Phone,
  Mail,
  Pencil,
  CheckCircle,
  XCircle,
  Trash2,
  FileText,
  Receipt,
} from "lucide-react";

interface JobDetailSheetProps {
  job: JobWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (job: JobWithCustomer) => void;
}

export function JobDetailSheet({ job, open, onOpenChange, onEdit }: JobDetailSheetProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const updateJob = useUpdateJob();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!job) return null;

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "in_progress" && !job.actual_start) {
        updates.actual_start = new Date().toISOString();
      }
      if (newStatus === "completed" && !job.actual_end) {
        updates.actual_end = new Date().toISOString();
      }
      await updateJob.mutateAsync({ id: job.id, ...updates });
      toast({
        title: "Status updated",
        description: `Job status changed to ${newStatus.replace("_", " ")}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update job status.",
        variant: "destructive",
      });
    }
  };

  const customerName = job.customer
    ? `${job.customer.first_name} ${job.customer.last_name}`
    : "Unknown Customer";

  const fullAddress = [
    job.address_line1,
    job.address_line2,
    job.city,
    job.state,
    job.zip,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-xl">{job.job_number}</SheetTitle>
                {job.title && (
                  <p className="text-muted-foreground mt-1">{job.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <JobStatusBadge status={job.status || "scheduled"} />
                <JobPriorityBadge priority={job.priority || "normal"} />
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6">
            {/* Schedule */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Schedule
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {job.scheduled_start
                      ? format(new Date(job.scheduled_start), "EEEE, MMMM d, yyyy")
                      : "Not scheduled"}
                  </span>
                </div>
                {job.scheduled_start && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(job.scheduled_start), "h:mm a")}
                      {job.scheduled_end && (
                        <> - {format(new Date(job.scheduled_end), "h:mm a")}</>
                      )}
                    </span>
                  </div>
                )}
                {job.assigned_to && job.assignee && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {job.assignee.first_name} {job.assignee.last_name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Customer */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                Customer
              </h3>
              <div className="space-y-2">
                <Link
                  to={`/customers/${job.customer_id}`}
                  className="font-medium hover:underline"
                >
                  {customerName}
                </Link>
                {job.customer?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${job.customer.email}`}
                      className="hover:underline"
                    >
                      {job.customer.email}
                    </a>
                  </div>
                )}
                {job.customer?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${job.customer.phone}`}
                      className="hover:underline"
                    >
                      {job.customer.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Address */}
            {fullAddress && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Job Location
                  </h3>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {fullAddress}
                    </a>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Time Tracking */}
            {(job.actual_start || job.actual_end) && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Time Tracking
                  </h3>
                  <div className="space-y-2 text-sm">
                    {job.actual_start && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Started</span>
                        <span>
                          {format(new Date(job.actual_start), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                    {job.actual_end && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ended</span>
                        <span>
                          {format(new Date(job.actual_end), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Notes */}
            {(job.notes || job.internal_notes) && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Notes
                  </h3>
                  {job.notes && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Job Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
                    </div>
                  )}
                  {job.internal_notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Internal Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {job.internal_notes}
                      </p>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Related */}
            {job.quote_id && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    Related
                  </h3>
                  <Link
                    to={`/quotes/${job.quote_id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    View Quote
                  </Link>
                </div>
                <Separator />
              </>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onEdit?.(job)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Job
              </Button>

              {job.status === "scheduled" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("in_progress")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Start Job
                </Button>
              )}

              {(job.status === "scheduled" || job.status === "in_progress") && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("completed")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Complete Job
                </Button>
              )}

              {job.status === "completed" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate(`/invoices/new?job_id=${job.id}&customer_id=${job.customer_id}`)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              )}

              {job.status !== "cancelled" && job.status !== "completed" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStatusChange("cancelled")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Job
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Job
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <DeleteJobDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        jobId={job.id}
        jobNumber={job.job_number}
        onSuccess={() => onOpenChange(false)}
      />
    </>
  );
}
