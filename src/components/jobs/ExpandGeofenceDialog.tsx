import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateJob, type JobWithCustomer } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";
import { addHours, endOfDay, format } from "date-fns";
import { Expand, Clock, MapPin, AlertTriangle } from "lucide-react";

interface ExpandGeofenceDialogProps {
  job: JobWithCustomer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DURATION_OPTIONS = [
  { value: "1", label: "1 hour", hours: 1 },
  { value: "2", label: "2 hours", hours: 2 },
  { value: "4", label: "4 hours", hours: 4 },
  { value: "eod", label: "Until end of day", hours: null },
];

const RADIUS_OPTIONS = [
  { value: "200", label: "200m", meters: 200, feet: 656 },
  { value: "300", label: "300m", meters: 300, feet: 984 },
  { value: "500", label: "500m", meters: 500, feet: 1640 },
  { value: "1000", label: "1km", meters: 1000, feet: 3281 },
];

export function ExpandGeofenceDialog({
  job,
  open,
  onOpenChange,
}: ExpandGeofenceDialogProps) {
  const { toast } = useToast();
  const updateJob = useUpdateJob();
  const [duration, setDuration] = useState("2");
  const [radius, setRadius] = useState("300");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRadius = job.geofence_radius_meters || 150;

  const getExpandUntil = () => {
    const option = DURATION_OPTIONS.find((o) => o.value === duration);
    if (!option) return new Date();
    if (option.hours === null) {
      return endOfDay(new Date());
    }
    return addHours(new Date(), option.hours);
  };

  const selectedRadius = RADIUS_OPTIONS.find((o) => o.value === radius);
  const expandUntil = getExpandUntil();

  const handleSubmit = async () => {
    if (!selectedRadius) return;

    setIsSubmitting(true);
    try {
      await updateJob.mutateAsync({
        id: job.id,
        geofence_expanded_radius_meters: selectedRadius.meters,
        geofence_expanded_until: expandUntil.toISOString(),
      });

      toast({
        title: "Geofence expanded",
        description: `Geofence expanded to ${selectedRadius.label} until ${format(expandUntil, "h:mm a")}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to expand geofence.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Expand className="h-5 w-5" />
            Expand Geofence
          </DialogTitle>
          <DialogDescription>
            Temporarily increase the geofence radius for this job. Workers will
            be able to clock in/out from a larger area.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Settings */}
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <MapPin className="h-4 w-4" />
              Current geofence radius
            </div>
            <div className="font-medium">
              {currentRadius}m ({Math.round(currentRadius * 3.281)}ft)
            </div>
          </div>

          {/* Duration Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </Label>
            <RadioGroup value={duration} onValueChange={setDuration}>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center">
                    <RadioGroupItem
                      value={option.value}
                      id={`duration-${option.value}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`duration-${option.value}`}
                      className="flex-1 cursor-pointer rounded-md border border-border bg-card p-3 text-center text-sm font-medium peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Radius Selection */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Expand className="h-4 w-4" />
              Expanded Radius
            </Label>
            <RadioGroup value={radius} onValueChange={setRadius}>
              <div className="grid grid-cols-2 gap-2">
                {RADIUS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center">
                    <RadioGroupItem
                      value={option.value}
                      id={`radius-${option.value}`}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={`radius-${option.value}`}
                      className="flex-1 cursor-pointer rounded-md border border-border bg-card p-3 text-center text-sm peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.feet.toLocaleString()}ft
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          {/* Reason (optional) */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Worker parking in remote lot due to construction"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Preview Summary */}
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-foreground/70 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Preview</div>
                <div className="text-muted-foreground">
                  Expand geofence from{" "}
                  <span className="font-medium">{currentRadius}m</span> to{" "}
                  <span className="font-medium">{selectedRadius?.label}</span>{" "}
                  until{" "}
                  <span className="font-medium">
                    {format(expandUntil, "h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Expanding..." : "Expand Geofence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
