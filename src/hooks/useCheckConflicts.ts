import { useMemo } from "react";
import type { JobWithCustomer } from "./useJobs";
import { areIntervalsOverlapping } from "date-fns";

interface ConflictCheckInput {
  jobId?: string;
  assignedTo?: string | null;
  scheduledStart?: string | Date | null;
  scheduledEnd?: string | Date | null;
}

export interface JobConflict {
  conflictingJob: JobWithCustomer;
  message: string;
}

export function useCheckConflicts(
  allJobs: JobWithCustomer[],
  input: ConflictCheckInput
): JobConflict[] {
  return useMemo(() => {
    const { jobId, assignedTo, scheduledStart, scheduledEnd } = input;

    // No conflicts if no assignment or schedule
    if (!assignedTo || !scheduledStart || !scheduledEnd) {
      return [];
    }

    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);

    // Filter jobs that could conflict
    const conflicts: JobConflict[] = [];

    for (const job of allJobs) {
      // Skip the current job
      if (jobId && job.id === jobId) continue;

      // Only check jobs assigned to the same person
      if (job.assigned_to !== assignedTo) continue;

      // Only check scheduled jobs
      if (!job.scheduled_start || !job.scheduled_end) continue;

      // Check for time overlap
      const jobStart = new Date(job.scheduled_start);
      const jobEnd = new Date(job.scheduled_end);

      const overlaps = areIntervalsOverlapping(
        { start, end },
        { start: jobStart, end: jobEnd }
      );

      if (overlaps) {
        const assigneeName = job.assignee
          ? `${job.assignee.first_name} ${job.assignee.last_name}`
          : "team member";

        conflicts.push({
          conflictingJob: job,
          message: `Conflicts with ${job.title || job.job_number} for ${assigneeName}`,
        });
      }
    }

    return conflicts;
  }, [allJobs, input.jobId, input.assignedTo, input.scheduledStart, input.scheduledEnd]);
}

export function findConflicts(
  allJobs: JobWithCustomer[],
  input: ConflictCheckInput
): JobConflict[] {
  const { jobId, assignedTo, scheduledStart, scheduledEnd } = input;

  if (!assignedTo || !scheduledStart || !scheduledEnd) {
    return [];
  }

  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);

  const conflicts: JobConflict[] = [];

  for (const job of allJobs) {
    if (jobId && job.id === jobId) continue;
    if (job.assigned_to !== assignedTo) continue;
    if (!job.scheduled_start || !job.scheduled_end) continue;

    const jobStart = new Date(job.scheduled_start);
    const jobEnd = new Date(job.scheduled_end);

    const overlaps = areIntervalsOverlapping(
      { start, end },
      { start: jobStart, end: jobEnd }
    );

    if (overlaps) {
      const assigneeName = job.assignee
        ? `${job.assignee.first_name} ${job.assignee.last_name}`
        : "team member";

      conflicts.push({
        conflictingJob: job,
        message: `Conflicts with ${job.title || job.job_number} for ${assigneeName}`,
      });
    }
  }

  return conflicts;
}
