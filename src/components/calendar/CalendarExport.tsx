import { useState } from "react";
import { format } from "date-fns";
import { Download, Printer, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { JobWithCustomer } from "@/hooks/useJobs";

interface CalendarExportProps {
  jobs: JobWithCustomer[];
  currentDate: Date;
  view: "month" | "week" | "day";
}

export function CalendarExport({ jobs, currentDate, view }: CalendarExportProps) {
  const { toast } = useToast();

  const handlePrint = () => {
    window.print();
  };

  const handleExportICS = () => {
    const scheduledJobs = jobs.filter((job) => job.scheduled_start);

    if (scheduledJobs.length === 0) {
      toast({
        title: "No jobs to export",
        description: "There are no scheduled jobs in the current view.",
        variant: "destructive",
      });
      return;
    }

    // Generate ICS content
    const icsEvents = scheduledJobs.map((job) => {
      const start = new Date(job.scheduled_start!);
      const end = job.scheduled_end ? new Date(job.scheduled_end) : new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

      const formatICSDate = (date: Date) => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      const customerName = job.customer
        ? `${job.customer.first_name} ${job.customer.last_name}`
        : "";

      const location = job.customer
        ? [job.customer.address_line1, job.customer.city, job.customer.state, job.customer.zip]
            .filter(Boolean)
            .join(", ")
        : "";

      return `BEGIN:VEVENT
UID:${job.id}@servicegrid
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:${job.job_number} - ${job.title}
DESCRIPTION:${job.description || ""}\\nCustomer: ${customerName}
LOCATION:${location}
STATUS:${job.status === "completed" ? "COMPLETED" : "CONFIRMED"}
END:VEVENT`;
    });

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ServiceGrid//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icsEvents.join("\n")}
END:VCALENDAR`;

    // Download the file
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `servicegrid-calendar-${format(currentDate, "yyyy-MM-dd")}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Calendar exported",
      description: `Exported ${scheduledJobs.length} job(s) to ICS file.`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportICS}>
          <Calendar className="mr-2 h-4 w-4" />
          Export to ICS
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
