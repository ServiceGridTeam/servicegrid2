import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Camera,
  X,
  Zap,
  ZapOff,
  SwitchCamera,
  Grid3x3,
  Check,
  Loader2,
  MapPinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GPSAccuracyIndicator } from "./GPSAccuracyIndicator";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePhotoSettings } from "@/hooks/usePhotoSettings";
import { toast } from "sonner";
import type { MediaCategory } from "@/hooks/useJobMedia";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File, category: MediaCategory, description?: string) => Promise<void>;
  defaultCategory?: MediaCategory;
}

const ALL_CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damage", label: "Damage" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

export function CameraCapture({
  open,
  onOpenChange,
  onCapture,
  defaultCategory = "general",
}: CameraCaptureProps) {
  // State
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [showGrid, setShowGrid] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory>(defaultCategory);
  const [description, setDescription] = useState("");
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashAnimation, setFlashAnimation] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Geolocation
  const { latitude, longitude, accuracy, getCurrentPosition } = useGeolocation();

  // Photo settings
  const { photoSettings } = usePhotoSettings();

  // Check if flash is supported
  const [flashSupported, setFlashSupported] = useState(false);

  // Filter categories based on business settings
  const filteredCategories = useMemo(() => {
    const allowed = photoSettings.allowed_categories;
    return ALL_CATEGORIES.filter((cat) => allowed.includes(cat.value));
  }, [photoSettings.allowed_categories]);

  // Check if GPS is required but unavailable
  const gpsBlocked = photoSettings.require_gps && (latitude === null || longitude === null);

  // Stop camera stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setCapturedImage(null);
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
    }
    setDescription("");
    setIsCapturing(false);
    setIsProcessing(false);
    setFlashAnimation(false);
  }, [capturedUrl]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check flash support
      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setFlashSupported(!!capabilities?.torch);

      setHasPermission(true);

      // Get initial GPS
      getCurrentPosition();
    } catch (error) {
      console.error("Camera access error:", error);
      setHasPermission(false);
      toast.error("Could not access camera. Please grant permission.");
    }
  }, [facingMode, getCurrentPosition]);

  // Toggle flash
  const toggleFlash = useCallback(async () => {
    if (!streamRef.current || !flashSupported) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    try {
      await videoTrack.applyConstraints({
        // @ts-ignore - torch is a valid constraint on mobile devices
        advanced: [{ torch: !flashOn }],
      });
      setFlashOn(!flashOn);
    } catch (error) {
      console.error("Flash toggle error:", error);
      toast.error("Could not toggle flash");
    }
  }, [flashOn, flashSupported]);

  // Flip camera
  const flipCamera = useCallback(() => {
    stopStream();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, [stopStream]);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsCapturing(true);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }

    // Flash animation
    setFlashAnimation(true);
    setTimeout(() => setFlashAnimation(false), 150);

    // Get fresh GPS position
    getCurrentPosition();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedImage(blob);
          setCapturedUrl(URL.createObjectURL(blob));
          stopStream();
        }
        setIsCapturing(false);
      },
      "image/jpeg",
      0.9
    );
  }, [stopStream, getCurrentPosition]);

  // Retake photo
  const handleRetake = useCallback(() => {
    resetState();
    startCamera();
  }, [resetState, startCamera]);

  // Confirm and upload
  const handleConfirm = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);

    try {
      const file = new File([capturedImage], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      await onCapture(file, selectedCategory, description || undefined);
      handleClose();
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload photo");
    } finally {
      setIsProcessing(false);
    }
  };

  // Close modal
  const handleClose = useCallback(() => {
    stopStream();
    resetState();
    onOpenChange(false);
    setHasPermission(null);
    setSelectedCategory(defaultCategory);
  }, [stopStream, resetState, onOpenChange, defaultCategory]);

  // Start camera when modal opens
  useEffect(() => {
    if (open && !capturedImage) {
      startCamera();
    }
    return () => {
      if (!open) {
        stopStream();
      }
    };
  }, [open, facingMode, capturedImage, startCamera, stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (capturedUrl) {
        URL.revokeObjectURL(capturedUrl);
      }
    };
  }, [stopStream, capturedUrl]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl md:max-w-3xl lg:max-w-4xl h-[90vh] md:h-[80vh] p-0 overflow-hidden bg-black border-0">
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Main content */}
        <div className="relative h-full flex flex-col">
          {/* Camera/Preview area */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            {hasPermission === false ? (
              <div className="text-center text-white p-8">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Camera access denied</p>
                <p className="text-sm text-white/60">
                  Please enable camera permissions in your browser settings
                </p>
              </div>
            ) : capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Captured photo"
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  playsInline
                  muted
                />

                {/* Grid overlay */}
                {showGrid && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => (
                        <div
                          key={i}
                          className="border border-white/30"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Flash animation overlay */}
                {flashAnimation && (
                  <div className="absolute inset-0 bg-white animate-[fade-out_0.15s_ease-out]" />
                )}
              </>
            )}

            {/* GPS indicator - top left */}
            <div className="absolute top-4 left-4 bg-black/50 rounded-full px-3 py-1.5">
              <GPSAccuracyIndicator
                accuracy={accuracy}
                latitude={latitude}
                longitude={longitude}
                showLabel
                className="text-white"
              />
            </div>

            {/* Camera controls - top right (when not captured) */}
            {!capturedUrl && hasPermission && (
              <div className="absolute top-4 right-16 flex items-center gap-2">
                {/* Grid toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-white hover:bg-white/20",
                    showGrid && "bg-white/30"
                  )}
                  onClick={() => setShowGrid(!showGrid)}
                >
                  <Grid3x3 className="h-5 w-5" />
                </Button>

                {/* Flash toggle */}
                {flashSupported && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "text-white hover:bg-white/20",
                      flashOn && "bg-yellow-500/50"
                    )}
                    onClick={toggleFlash}
                  >
                    {flashOn ? (
                      <Zap className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <ZapOff className="h-5 w-5" />
                    )}
                  </Button>
                )}

                {/* Flip camera */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={flipCamera}
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="bg-background p-4 space-y-4">
            {/* GPS Required Warning */}
            {gpsBlocked && (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg">
                <MapPinOff className="h-4 w-4" />
                <span className="text-sm font-medium">GPS required - Enable location to capture</span>
              </div>
            )}

            {/* Category pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    selectedCategory === cat.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Description input (only when captured) */}
            {capturedUrl && (
              <Input
                placeholder="Add a description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="max-w-md mx-auto"
              />
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4">
              {!capturedUrl ? (
                <Button
                  size="lg"
                  className="rounded-full h-16 w-16 bg-white hover:bg-white/90 text-black disabled:opacity-50"
                  onClick={capturePhoto}
                  disabled={isCapturing || hasPermission === false || gpsBlocked}
                >
                  {isCapturing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleRetake}
                    disabled={isProcessing}
                  >
                    Retake
                  </Button>
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={handleConfirm}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Use Photo
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
