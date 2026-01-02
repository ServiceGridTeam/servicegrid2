import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobTable, JobDetailSheet, JobFormDialog } from "@/components/jobs";
import { useJobs, type JobWithCustomer } from "@/hooks/useJobs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Skeleton } from "@/components/ui/skeleton";

const statusTabs = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function Jobs() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobWithCustomer | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: jobs = [], isLoading } = useJobs({
    search: debouncedSearch || undefined,
    status: statusFilter,
  });

  const handleViewJob = (job: JobWithCustomer) => {
    setSelectedJob(job);
    setDetailSheetOpen(true);
  };

  const handleEditJob = (job: JobWithCustomer) => {
    setEditingJob(job);
    setFormDialogOpen(true);
    setDetailSheetOpen(false);
  };

  const handleNewJob = () => {
    setEditingJob(null);
    setFormDialogOpen(true);
  };

  const filteredJobs = statusFilter === "all"
    ? jobs
    : jobs.filter((job) => job.status === statusFilter);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground">
            Manage and schedule your service jobs
          </p>
        </div>
        <Button onClick={handleNewJob}>
          <Plus className="mr-2 h-4 w-4" />
          New Job
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              {search || statusFilter !== "all" ? "No jobs found" : "No jobs yet"}
            </h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Schedule your first job to get started."}
            </p>
            {!search && statusFilter === "all" && (
              <Button onClick={handleNewJob}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Your First Job
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <JobTable
              jobs={filteredJobs}
              onViewJob={handleViewJob}
              onEditJob={handleEditJob}
            />
          </CardContent>
        </Card>
      )}

      <JobDetailSheet
        job={selectedJob}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={handleEditJob}
      />

      <JobFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        job={editingJob}
      />
    </div>
  );
}
