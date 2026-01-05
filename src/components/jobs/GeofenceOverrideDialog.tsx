import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Camera, AlertTriangle, Loader2 } from "lucide-react";
import { useClockInWithOverride } from "@/hooks/useGeofenceValidation";
import { useToast } from "@/hooks/use-toast";

interface GeofenceOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  distanceFeet: number;
  requiresReason: boolean;
  requiresPhoto: boolean;
  eventType: "clock_in" | "clock_out";
  onSuccess: () => void;
}

export function GeofenceOverrideDialog({
  open,
  onOpenChange,
  jobId,
  location,
  distanceFeet,
  requiresReason,
  requiresPhoto,
  eventType,
  onSuccess,
}: GeofenceOverrideDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const clockInOverride = useClockInWithOverride();

  const handlePhotoCapture = async () => {
    setCaptureError(null);
    
    try {
      // Try to use camera capture on mobile
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch (error) {
      setCaptureError("Unable to access camera. Please try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.onerror = () => {
      setCaptureError("Failed to read photo. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (requiresReason && !reason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for clocking in outside the job site.",
        variant: "destructive",
      });
      return;
    }

    if (requiresPhoto && !photoBase64) {
      toast({
        title: "Photo required",
        description: "Please take a photo to verify your location.",
        variant: "destructive",
      });
      return;
    }

    try {
      await clockInOverride.mutateAsync({
        jobId,
        location,
        reason: reason.trim(),
        photoBase64: photoBase64 || undefined,
        eventType,
      });

      toast({
        title: eventType === "clock_in" ? "Clocked in" : "Clocked out",
        description: "Override recorded successfully.",
      });

      onSuccess();
      onOpenChange(false);
      setReason("");
      setPhotoBase64(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process override",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setReason("");
    setPhotoBase64(null);
    setCaptureError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Outside Job Site Geofence
          </DialogTitle>
          <DialogDescription>
            You are {distanceFeet.toLocaleString()} feet from the job site. Please provide additional information to {eventType === "clock_in" ? "clock in" : "clock out"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Distance indicator */}
          <Alert>
            <MapPin className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">{distanceFeet.toLocaleString()} ft</span> from job location
            </AlertDescription>
          </Alert>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason for {eventType === "clock_in" ? "clocking in" : "clocking out"} here
              {requiresReason && <span className="text-destructive"> *</span>}
            </Label>
            <Textarea
              id="reason"
              placeholder="e.g., Meeting customer at alternate location, equipment stored here..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Photo capture */}
          {requiresPhoto && (
            <div className="space-y-2">
              <Label>
                Location photo <span className="text-destructive">*</span>
              </Label>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {photoBase64 ? (
                <div className="relative">
                  <img
                    src={photoBase64}
                    alt="Captured location"
                    className="w-full h-32 object-cover rounded-md border"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={handlePhotoCapture}
                  >
                    Retake
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                  onClick={handlePhotoCapture}
                >
                  <Camera className="h-6 w-6" />
                  <span>Take Photo</span>
                </Button>
              )}

              {captureError && (
                <p className="text-sm text-destructive">{captureError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={clockInOverride.isPending}
          >
            {clockInOverride.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {eventType === "clock_in" ? "Clock In" : "Clock Out"} with Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
