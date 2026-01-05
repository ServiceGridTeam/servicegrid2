import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Eye, Pencil, CheckCircle, XCircle, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { JobStatusBadge } from "./JobStatusBadge";
import { JobPriorityBadge } from "./JobPriorityBadge";
import { DeleteJobDialog } from "./DeleteJobDialog";
import { useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface JobTableProps {
  jobs: JobWithCustomer[];
  onViewJob?: (job: JobWithCustomer) => void;
  onEditJob?: (job: JobWithCustomer) => void;
  selectable?: boolean;
  selectedJobIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function JobTable({ 
  jobs, 
  onViewJob, 
  onEditJob,
  selectable = false,
  selectedJobIds = [],
  onSelectionChange,
}: JobTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const updateJob = useUpdateJob();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);

  const handleStatusChange = async (job: JobWithCustomer, newStatus: string) => {
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

  const getCustomerName = (job: JobWithCustomer) => {
    if (!job.customer) return "Unknown Customer";
    return `${job.customer.first_name} ${job.customer.last_name}`;
  };

  const getAddress = (job: JobWithCustomer) => {
    const parts = [job.address_line1, job.city, job.state].filter(Boolean);
    return parts.join(", ") || "No address";
  };

  const isAllSelected = jobs.length > 0 && jobs.every(job => selectedJobIds.includes(job.id));
  const isSomeSelected = jobs.some(job => selectedJobIds.includes(job.id)) && !isAllSelected;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange?.(jobs.map(job => job.id));
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedJobIds, jobId]);
    } else {
      onSelectionChange?.(selectedJobIds.filter(id => id !== jobId));
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isSomeSelected;
                    }
                  }}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Job</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const isSelected = selectedJobIds.includes(job.id);
            return (
              <TableRow
                key={job.id}
                className={cn(
                  "cursor-pointer",
                  isSelected && "bg-primary/5"
                )}
                onClick={() => onViewJob?.(job)}
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                      aria-label={`Select job ${job.job_number}`}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div>
                    <p className="font-medium">{job.job_number}</p>
                    {job.title && (
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {job.title}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{getCustomerName(job)}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {getAddress(job)}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status || "scheduled"} />
                </TableCell>
                <TableCell>
                  <JobPriorityBadge priority={job.priority || "normal"} />
                </TableCell>
                <TableCell>
                  {job.scheduled_start ? (
                    <div>
                      <p>{format(new Date(job.scheduled_start), "MMM d, yyyy")}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(job.scheduled_start), "h:mm a")}
                      </p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell>
                  {job.assignee ? (
                    <span>
                      {job.assignee.first_name} {job.assignee.last_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewJob?.(job);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditJob?.(job);
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {job.status !== "completed" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(job, "completed");
                          }}
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark Complete
                        </DropdownMenuItem>
                      )}
                      {job.status !== "cancelled" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(job, "cancelled");
                          }}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Job
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(job);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedJob && (
        <DeleteJobDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          jobId={selectedJob.id}
          jobNumber={selectedJob.job_number}
        />
      )}
    </>
  );
}
