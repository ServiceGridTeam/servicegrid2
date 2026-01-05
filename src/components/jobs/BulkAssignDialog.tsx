import { useState } from "react";
import { format, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Wand2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBulkAutoAssign, type BulkAssignResult } from "@/hooks/useBulkAutoAssign";
import { useTeamMembers } from "@/hooks/useTeamManagement";
import { useToast } from "@/hooks/use-toast";

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobIds: string[];
  onComplete?: () => void;
}

type Step = "configure" | "progress" | "results";

export function BulkAssignDialog({
  open,
  onOpenChange,
  selectedJobIds,
  onComplete,
}: BulkAssignDialogProps) {
  const { toast } = useToast();
  const bulkAssign = useBulkAutoAssign();
  const { data: teamMembers = [] } = useTeamMembers();

  const [step, setStep] = useState<Step>("configure");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(addDays(new Date(), 7));
  const [balanceWorkload, setBalanceWorkload] = useState(true);
  const [maxJobsPerWorker, setMaxJobsPerWorker] = useState(8);
  const [selectAllWorkers, setSelectAllWorkers] = useState(true);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [result, setResult] = useState<BulkAssignResult | null>(null);

  const handleClose = () => {
    setStep("configure");
    setResult(null);
    onOpenChange(false);
  };

  const handleAssign = async () => {
    setStep("progress");

    try {
      const assignResult = await bulkAssign.mutateAsync({
        jobIds: selectedJobIds,
        dateRange: {
          start: format(startDate, "yyyy-MM-dd"),
          end: format(endDate, "yyyy-MM-dd"),
        },
        balanceWorkload,
        constraints: {
          maxJobsPerWorker,
          preferredWorkerIds: selectAllWorkers ? undefined : selectedWorkerIds,
        },
      });

      setResult(assignResult);
      setStep("results");

      toast({
        title: "Bulk Assignment Complete",
        description: `Assigned ${assignResult.summary.assigned} of ${assignResult.summary.totalJobs} jobs`,
      });

    } catch (error) {
      setStep("configure");
      toast({
        title: "Assignment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDone = () => {
    handleClose();
    onComplete?.();
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Bulk Auto-Assign
          </DialogTitle>
          <DialogDescription>
            {step === "configure" && `Assign ${selectedJobIds.length} jobs to your team`}
            {step === "progress" && "Assigning jobs..."}
            {step === "results" && "Assignment complete"}
          </DialogDescription>
        </DialogHeader>

        {step === "configure" && (
          <div className="space-y-6">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, "MMM d, yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Workers Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Workers
              </Label>
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="all-workers"
                  checked={selectAllWorkers}
                  onCheckedChange={(checked) => setSelectAllWorkers(!!checked)}
                />
                <label htmlFor="all-workers" className="text-sm">All workers</label>
              </div>
              {!selectAllWorkers && (
                <ScrollArea className="h-32 rounded-md border p-2">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={member.id}
                        checked={selectedWorkerIds.includes(member.id)}
                        onCheckedChange={() => toggleWorker(member.id)}
                      />
                      <label htmlFor={member.id} className="text-sm">
                        {member.first_name} {member.last_name}
                      </label>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="balance-workload">Balance workload across team</Label>
                <Switch
                  id="balance-workload"
                  checked={balanceWorkload}
                  onCheckedChange={setBalanceWorkload}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="max-jobs">Max jobs per worker per day</Label>
                <Input
                  id="max-jobs"
                  type="number"
                  min={1}
                  max={20}
                  value={maxJobsPerWorker}
                  onChange={(e) => setMaxJobsPerWorker(Number(e.target.value))}
                  className="w-20 text-center"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleAssign} disabled={bulkAssign.isPending}>
                <Wand2 className="mr-2 h-4 w-4" />
                Assign Jobs
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "progress" && (
          <div className="py-8 space-y-4 text-center">
            <Wand2 className="h-12 w-12 mx-auto text-primary animate-pulse" />
            <p className="text-muted-foreground">
              Distributing {selectedJobIds.length} jobs across your team...
            </p>
            <Progress value={50} className="w-full" />
          </div>
        )}

        {step === "results" && result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{result.summary.totalJobs}</p>
                <p className="text-xs text-muted-foreground">Total Jobs</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <p className="text-2xl font-bold text-primary">{result.summary.assigned}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className={cn(
                "p-3 rounded-lg",
                result.summary.unassigned > 0 ? "bg-destructive/10" : "bg-muted/50"
              )}>
                <p className={cn(
                  "text-2xl font-bold",
                  result.summary.unassigned > 0 && "text-destructive"
                )}>{result.summary.unassigned}</p>
                <p className="text-xs text-muted-foreground">Unassigned</p>
              </div>
            </div>

            {/* Workers Used */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{result.summary.workersUsed} workers assigned jobs</span>
            </div>

            {/* Assignments List */}
            {result.assignments.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  Assigned Jobs
                </Label>
                <ScrollArea className="h-32 rounded-md border p-2">
                  {result.assignments.map((assignment) => (
                    <div key={assignment.jobId} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Job assigned to</span>
                      <Badge variant="secondary">{assignment.userName}</Badge>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Unassigned List */}
            {result.unassignedJobs.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Unassigned Jobs
                </Label>
                <ScrollArea className="h-24 rounded-md border p-2">
                  {result.unassignedJobs.map((job) => (
                    <div key={job.jobId} className="py-1 text-sm">
                      <span className="font-medium">{job.jobNumber}</span>
                      <span className="text-muted-foreground ml-2">- {job.reason}</span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Done Button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleDone}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
