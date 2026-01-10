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
import { ClockInOutButton } from "./ClockInOutButton";
import { AssigneeAvatarGroup } from "./AssigneeAvatarGroup";
import { AutoAssignButton } from "./AutoAssignButton";
import { ClockEventTimeline } from "./ClockEventTimeline";
import { ExpandGeofenceDialog } from "./ExpandGeofenceDialog";
import { JobLaborCard } from "./JobLaborCard";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoCaptureButton } from "./PhotoCaptureButton";
import { MediaGalleryPreview } from "./MediaGalleryPreview";
import { TimeEntriesTable } from "@/components/team/TimeEntriesTable";
import { useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { useBusiness } from "@/hooks/useBusiness";
import { useJobMedia } from "@/hooks/useJobMedia";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  Mail,
  Pencil,
  CheckCircle,
  XCircle,
  Trash2,
  FileText,
  Receipt,
  Timer,
  Shield,
  Expand,
  Camera,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
  const { data: business } = useBusiness();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showTimeEntries, setShowTimeEntries] = useState(false);
  const [expandDialogOpen, setExpandDialogOpen] = useState(false);
  const [showMediaSection, setShowMediaSection] = useState(false);

  // Check if geofence is currently expanded
  const isGeofenceExpanded =
    job?.geofence_expanded_until &&
    job?.geofence_expanded_radius_meters &&
    !isPast(new Date(job.geofence_expanded_until));

  const handleCancelExpansion = async () => {
    try {
      await updateJob.mutateAsync({
        id: job.id,
        geofence_expanded_radius_meters: null,
        geofence_expanded_until: null,
      });
      toast({
        title: "Expansion cancelled",
        description: "Geofence has been restored to normal radius.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel geofence expansion.",
        variant: "destructive",
      });
    }
  };

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
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle className="text-xl">{job.job_number}</SheetTitle>
                {job.title && (
                  <p className="text-muted-foreground mt-1">{job.title}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!job.scheduled_start && (
                  <AutoAssignButton job={job} variant="compact" />
                )}
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
              </div>
            </div>

            {/* Assigned Team */}
            {(job.assignments && job.assignments.length > 0) || job.assignee ? (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Assigned Team
                  </h3>
                  <div className="space-y-2">
                    {job.assignments && job.assignments.length > 0 ? (
                      job.assignments.map((assignment, index) => (
                        <div 
                          key={assignment.id} 
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={assignment.user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {assignment.user.first_name?.[0]}
                              {assignment.user.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {assignment.user.first_name} {assignment.user.last_name}
                              </span>
                              {index === 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                  Lead
                                </Badge>
                              )}
                            </div>
                            {assignment.user.email && (
                              <span className="text-xs text-muted-foreground truncate">
                                {assignment.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : job.assignee ? (
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {job.assignee.first_name?.[0]}
                            {job.assignee.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {job.assignee.first_name} {job.assignee.last_name}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

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
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Time Tracking
                </h3>
                {business && (job.status === "scheduled" || job.status === "in_progress") && (
                  <ClockInOutButton
                    jobId={job.id}
                    businessId={business.id}
                    variant="compact"
                  />
                )}
              </div>
              
              {(job.actual_start || job.actual_end) && (
                <div className="space-y-2 text-sm mb-4">
                  {job.actual_start && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Started</span>
                      <span>
                        {format(new Date(job.actual_start), "MMM d, h:mm a")}
                      </span>
                    </div>
                  )}
                  {job.actual_end && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Ended</span>
                      <span>
                        {format(new Date(job.actual_end), "MMM d, h:mm a")}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => setShowTimeEntries(!showTimeEntries)}
              >
                {showTimeEntries ? "Hide" : "Show"} Time Entries
              </Button>
              
              {showTimeEntries && (
                <div className="mt-4">
                  <TimeEntriesTable jobId={job.id} />
                </div>
              )}
              
              <div className="mt-4">
                <ClockEventTimeline jobId={job.id} />
              </div>
              
              {/* Labor Cost Summary */}
              <div className="mt-4">
                <JobLaborCard 
                  jobId={job.id} 
                  estimatedMinutes={job.estimated_duration_minutes} 
                />
              </div>
            </div>
            <Separator />

            {/* Geofence Settings */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Geofence Settings
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Radius</span>
                  <span>
                    {job.geofence_radius_meters ||
                      business?.default_geofence_radius_meters ||
                      150}
                    m
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Enforcement</span>
                  <span className="capitalize">
                    {job.geofence_enforcement ||
                      business?.geofence_enforcement_mode ||
                      "warn"}
                  </span>
                </div>

                {isGeofenceExpanded && (
                  <div className="mt-2 p-3 rounded-lg border border-foreground/10 bg-foreground/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Expand className="h-4 w-4 text-foreground/70" />
                        <span className="text-sm font-medium">
                          Temporarily Expanded
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {job.geofence_expanded_radius_meters}m
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Expires{" "}
                      {formatDistanceToNow(
                        new Date(job.geofence_expanded_until!),
                        { addSuffix: true }
                      )}{" "}
                      ({format(
                        new Date(job.geofence_expanded_until!),
                        "h:mm a"
                      )})
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={handleCancelExpansion}
                    >
                      Cancel Expansion
                    </Button>
                  </div>
                )}

                {!isGeofenceExpanded &&
                  (job.status === "scheduled" ||
                    job.status === "in_progress") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => setExpandDialogOpen(true)}
                    >
                      <Expand className="h-4 w-4" />
                      Expand Geofence Temporarily
                    </Button>
                  )}
              </div>
            </div>
            <Separator />

            {/* Photos & Media */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos & Media
                </h3>
                <div className="flex items-center gap-2">
                  <PhotoCaptureButton jobId={job.id} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowMediaSection(!showMediaSection)}
                  >
                    {showMediaSection ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {!showMediaSection ? (
                <MediaGalleryPreview 
                  jobId={job.id} 
                  onViewAll={() => setShowMediaSection(true)}
                />
              ) : (
                <PhotoGrid jobId={job.id} />
              )}
            </div>
            <Separator />

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

      <ExpandGeofenceDialog
        job={job}
        open={expandDialogOpen}
        onOpenChange={setExpandDialogOpen}
      />
    </>
  );
}
