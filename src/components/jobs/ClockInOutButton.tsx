import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useActiveTimeEntryForJob, useClockIn, useClockOut } from "@/hooks/useTimeEntries";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useValidateClockIn, GeofenceValidationResult } from "@/hooks/useGeofenceValidation";
import { useToast } from "@/hooks/use-toast";
import { Clock, Play, Square, MapPin, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationAccuracyIndicator } from "./LocationAccuracyIndicator";
import { GeofenceOverrideDialog } from "./GeofenceOverrideDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClockInOutButtonProps {
  jobId: string;
  businessId: string;
  variant?: "default" | "compact";
  className?: string;
}

function formatDuration(startTime: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

type ClockState = 
  | "idle" 
  | "locating" 
  | "validating" 
  | "in_range" 
  | "out_of_range_warn" 
  | "out_of_range_strict" 
  | "clocked_in"
  | "accuracy_warning";

export function ClockInOutButton({ 
  jobId, 
  businessId, 
  variant = "default",
  className 
}: ClockInOutButtonProps) {
  const { toast } = useToast();
  const { data: activeEntry, isLoading } = useActiveTimeEntryForJob(jobId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const geolocation = useGeolocation();
  const validateClockIn = useValidateClockIn();
  
  const [duration, setDuration] = useState<string>("");
  const [clockState, setClockState] = useState<ClockState>("idle");
  const [validationResult, setValidationResult] = useState<GeofenceValidationResult | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [showAccuracyWarning, setShowAccuracyWarning] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [pendingClockInLocation, setPendingClockInLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Update duration every second when clocked in
  useEffect(() => {
    if (!activeEntry) {
      setDuration("");
      setClockState("idle");
      return;
    }

    setClockState("clocked_in");
    const updateDuration = () => {
      setDuration(formatDuration(new Date(activeEntry.clock_in)));
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const proceedWithValidation = async (location: { lat: number; lng: number; accuracy?: number }) => {
    // Validate geofence
    setClockState("validating");
    const validation = await validateClockIn.mutateAsync({
      jobId,
      location,
      locationSource: "gps",
      eventType: "clock_in",
    });

    setValidationResult(validation);

    if (validation.within_geofence) {
      // Within geofence - proceed with clock in
      setClockState("in_range");
      await performClockIn(location);
    } else if (validation.enforcement_mode === "warn") {
      // Outside but allowed with warning
      setClockState("out_of_range_warn");
      toast({
        title: "Location Warning",
        description: `You are ${validation.distance_feet} feet from the job site`,
      });
      await performClockIn(location);
    } else if (validation.enforcement_mode === "strict") {
      // Outside and blocked - show override dialog if allowed
      setClockState("out_of_range_strict");
      if (validation.can_override) {
        setShowOverrideDialog(true);
      } else {
        toast({
          title: "Cannot Clock In",
          description: `You must be within ${Math.round(validation.geofence_radius_meters * 3.28084)} feet of the job site`,
          variant: "destructive",
        });
      }
    } else {
      // Enforcement is off - proceed
      await performClockIn(location);
    }
  };

  const handleClockInClick = async () => {
    setClockState("locating");
    setValidationResult(null);

    try {
      // Get current location
      const locationResult = await geolocation.getCurrentPosition();
      
      if (locationResult.error || !locationResult.latitude || !locationResult.longitude) {
        toast({
          title: "Location Error",
          description: locationResult.error || "Unable to get your location",
          variant: "destructive",
        });
        setClockState("idle");
        return;
      }

      const location = {
        lat: locationResult.latitude,
        lng: locationResult.longitude,
        accuracy: locationResult.accuracy || undefined,
      };
      setCurrentLocation(location);

      // Check GPS accuracy - warn if > 50 meters
      if (location.accuracy && location.accuracy > 50) {
        setPendingClockInLocation(location);
        setClockState("accuracy_warning");
        setShowAccuracyWarning(true);
        return;
      }

      await proceedWithValidation(location);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to validate location",
        variant: "destructive",
      });
      setClockState("idle");
    }
  };

  const handleAccuracyConfirm = async () => {
    setShowAccuracyWarning(false);
    if (pendingClockInLocation) {
      try {
        await proceedWithValidation(pendingClockInLocation);
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to validate location",
          variant: "destructive",
        });
        setClockState("idle");
      }
    }
    setPendingClockInLocation(null);
  };

  const handleAccuracyRetry = () => {
    setShowAccuracyWarning(false);
    setPendingClockInLocation(null);
    setClockState("idle");
    // Trigger a fresh location request
    handleClockInClick();
  };

  const handleAccuracyCancel = () => {
    setShowAccuracyWarning(false);
    setPendingClockInLocation(null);
    setClockState("idle");
  };

  const performClockIn = async (location: { lat: number; lng: number; accuracy?: number }) => {
    try {
      await clockIn.mutateAsync({ 
        jobId, 
        businessId,
      });
      toast({
        title: "Clocked in",
        description: "Time tracking started for this job.",
      });
      setClockState("clocked_in");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock in. Please try again.",
        variant: "destructive",
      });
      setClockState("idle");
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    
    setClockState("locating");
    
    try {
      // Get current location for clock out
      const locationResult = await geolocation.getCurrentPosition();
      
      const location = locationResult.latitude && locationResult.longitude
        ? {
            lat: locationResult.latitude,
            lng: locationResult.longitude,
            accuracy: locationResult.accuracy || undefined,
          }
        : null;

      // Validate clock out location (if we have it)
      if (location) {
        setClockState("validating");
        const validation = await validateClockIn.mutateAsync({
          jobId,
          location,
          locationSource: "gps",
          eventType: "clock_out",
        });

        if (!validation.within_geofence && validation.enforcement_mode === "strict") {
          setValidationResult(validation);
          setCurrentLocation(location);
          if (validation.can_override) {
            setShowOverrideDialog(true);
            return;
          }
        }
      }

      // Proceed with clock out
      await clockOut.mutateAsync({ entryId: activeEntry.id });
      toast({
        title: "Clocked out",
        description: "Time tracking stopped.",
      });
      setClockState("idle");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clock out. Please try again.",
        variant: "destructive",
      });
      setClockState("clocked_in");
    }
  };

  const handleOverrideSuccess = () => {
    setClockState(activeEntry ? "idle" : "clocked_in");
    setShowOverrideDialog(false);
    setValidationResult(null);
  };

  if (isLoading) {
    return (
      <Button variant="outline" size={variant === "compact" ? "sm" : "default"} disabled className={className}>
        <Clock className="h-4 w-4 animate-pulse" />
        {variant === "default" && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  // Locating state
  if (clockState === "locating") {
    return (
      <Button 
        variant="outline" 
        size={variant === "compact" ? "sm" : "default"} 
        disabled 
        className={cn("gap-2", className)}
      >
        <MapPin className="h-4 w-4 animate-pulse" />
        {variant === "default" && "Getting location..."}
      </Button>
    );
  }

  // Validating state
  if (clockState === "validating") {
    return (
      <Button 
        variant="outline" 
        size={variant === "compact" ? "sm" : "default"} 
        disabled 
        className={cn("gap-2", className)}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {variant === "default" && "Validating..."}
      </Button>
    );
  }

  // Clocked in state
  if (activeEntry) {
    return (
      <>
        <div className="flex flex-col gap-1">
          <Button
            variant="destructive"
            size={variant === "compact" ? "sm" : "default"}
            onClick={handleClockOut}
            disabled={clockOut.isPending}
            className={cn("gap-2", className)}
          >
            <Square className="h-4 w-4 fill-current" />
            {variant === "default" ? (
              <>Clock Out ({duration})</>
            ) : (
              <span className="text-xs">{duration}</span>
            )}
          </Button>
          {variant === "default" && geolocation.accuracy && (
            <LocationAccuracyIndicator accuracy={geolocation.accuracy} className="justify-center" />
          )}
        </div>

        <GeofenceOverrideDialog
          open={showOverrideDialog}
          onOpenChange={setShowOverrideDialog}
          jobId={jobId}
          location={currentLocation || { lat: 0, lng: 0 }}
          distanceFeet={validationResult?.distance_feet || 0}
          requiresReason={validationResult?.override_requires_reason || false}
          requiresPhoto={validationResult?.override_requires_photo || false}
          eventType="clock_out"
          onSuccess={handleOverrideSuccess}
        />
      </>
    );
  }

  // Out of range strict state
  if (clockState === "out_of_range_strict" && validationResult) {
    return (
      <>
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            size={variant === "compact" ? "sm" : "default"}
            onClick={() => validationResult.can_override && setShowOverrideDialog(true)}
            className={cn("gap-2 border-destructive text-destructive", className)}
          >
            <AlertTriangle className="h-4 w-4" />
            {variant === "default" && (
              <>
                {validationResult.can_override 
                  ? `Override (${validationResult.distance_feet} ft away)` 
                  : `Too far (${validationResult.distance_feet} ft)`
                }
              </>
            )}
          </Button>
          {variant === "default" && (
            <p className="text-xs text-center text-muted-foreground">
              Must be within {Math.round(validationResult.geofence_radius_meters * 3.28084)} ft
            </p>
          )}
        </div>

        <GeofenceOverrideDialog
          open={showOverrideDialog}
          onOpenChange={setShowOverrideDialog}
          jobId={jobId}
          location={currentLocation || { lat: 0, lng: 0 }}
          distanceFeet={validationResult.distance_feet}
          requiresReason={validationResult.override_requires_reason}
          requiresPhoto={validationResult.override_requires_photo}
          eventType="clock_in"
          onSuccess={handleOverrideSuccess}
        />
      </>
    );
  }

  // Default idle state - Clock In button
  return (
    <>
      <Button
        variant="default"
        size={variant === "compact" ? "sm" : "default"}
        onClick={handleClockInClick}
        disabled={clockIn.isPending}
        className={cn("gap-2", className)}
      >
        <Play className="h-4 w-4 fill-current" />
        {variant === "default" && "Clock In"}
      </Button>

      {/* GPS Accuracy Warning Dialog */}
      <AlertDialog open={showAccuracyWarning} onOpenChange={setShowAccuracyWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Poor GPS Accuracy
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Your current GPS accuracy is <span className="font-semibold">{Math.round(pendingClockInLocation?.accuracy || 0)} meters</span>, 
                which may result in inaccurate location tracking.
              </p>
              <p className="text-muted-foreground text-sm">
                For best results, ensure you have a clear view of the sky and GPS is enabled.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleAccuracyCancel}>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleAccuracyRetry}>
              <MapPin className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <AlertDialogAction onClick={handleAccuracyConfirm}>
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
