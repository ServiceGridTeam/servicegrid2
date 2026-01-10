import { useState, useRef, useCallback, useEffect } from "react";
import { Video, Square, Pause, Play, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { 
  formatDuration, 
  getSupportedVideoMimeType, 
  isVideoRecordingSupported,
  extractVideoMetadata,
  extractVideoThumbnail 
} from "@/lib/videoUtils";
import { toast } from "sonner";

const MAX_DURATION_SECONDS = 60;
const WARNING_THRESHOLD_SECONDS = 50;

interface VideoRecordButtonProps {
  onVideoRecorded: (file: File, thumbnailBlob: Blob, durationSeconds: number) => void;
  disabled?: boolean;
}

export function VideoRecordButton({ onVideoRecorded, disabled }: VideoRecordButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setRecordedBlob(null);
    chunksRef.current = [];
    pausedDurationRef.current = 0;
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    stopStream();
    resetState();
    setIsOpen(false);
    setHasPermission(null);
  }, [stopStream, resetState]);

  const startCamera = async () => {
    if (!isVideoRecordingSupported()) {
      toast.error("Video recording is not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (error) {
      console.error('Camera access error:', error);
      setHasPermission(false);
      toast.error("Could not access camera. Please grant permission.");
    }
  };

  const updateTimer = useCallback(() => {
    if (!isRecording || isPaused) return;
    
    const elapsed = (Date.now() - startTimeRef.current) / 1000 + pausedDurationRef.current;
    setDuration(Math.min(elapsed, MAX_DURATION_SECONDS));
    
    if (elapsed >= MAX_DURATION_SECONDS) {
      stopRecording();
      toast.info("Maximum recording time reached (60 seconds)");
      return;
    }
    
    if (elapsed >= WARNING_THRESHOLD_SECONDS && elapsed < WARNING_THRESHOLD_SECONDS + 0.5) {
      toast.warning("10 seconds remaining");
    }
    
    timerRef.current = requestAnimationFrame(updateTimer);
  }, [isRecording, isPaused]);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = requestAnimationFrame(updateTimer);
    }
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [isRecording, isPaused, updateTimer]);

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mimeType = getSupportedVideoMimeType();
    
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        stopStream();
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error('MediaRecorder error:', error);
      toast.error("Failed to start recording");
    }
  };

  const pauseRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    if (isPaused) {
      // Resume
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      setIsPaused(false);
    } else {
      // Pause
      mediaRecorderRef.current.pause();
      pausedDurationRef.current += (Date.now() - startTimeRef.current) / 1000;
      setIsPaused(true);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    setIsPaused(false);
  };

  const handleRetake = () => {
    resetState();
    startCamera();
  };

  const handleConfirm = async () => {
    if (!recordedBlob) return;
    
    setIsProcessing(true);
    
    try {
      // Create file from blob
      const extension = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([recordedBlob], `video-${Date.now()}.${extension}`, {
        type: recordedBlob.type,
      });
      
      // Extract metadata and thumbnail
      const [metadata, thumbnailBlob] = await Promise.all([
        extractVideoMetadata(file),
        extractVideoThumbnail(file),
      ]);
      
      onVideoRecorded(file, thumbnailBlob, metadata.duration);
      handleClose();
    } catch (error) {
      console.error('Video processing error:', error);
      toast.error("Failed to process video");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setIsOpen(true);
      startCamera();
    } else {
      handleClose();
    }
  };

  if (!isVideoRecordingSupported()) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
      >
        <Video className="h-4 w-4" />
        Record Video
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Video preview area */}
          <div className="relative aspect-video bg-black flex items-center justify-center">
            {hasPermission === false ? (
              <div className="text-center text-white p-8">
                <p className="text-lg mb-2">Camera access denied</p>
                <p className="text-sm text-white/60">
                  Please enable camera permissions in your browser settings
                </p>
              </div>
            ) : recordedBlob ? (
              <video
                src={URL.createObjectURL(recordedBlob)}
                className="w-full h-full object-contain"
                controls
                autoPlay
                muted
              />
            ) : (
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                muted
                playsInline
              />
            )}

            {/* Timer display */}
            {(isRecording || recordedBlob) && (
              <div className={cn(
                "absolute top-4 left-4 px-3 py-1.5 rounded-full font-mono text-lg",
                duration >= WARNING_THRESHOLD_SECONDS && isRecording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "bg-black/50 text-white"
              )}>
                {formatDuration(duration)} / {formatDuration(MAX_DURATION_SECONDS)}
              </div>
            )}

            {/* Recording indicator */}
            {isRecording && !isPaused && (
              <div className="absolute top-4 right-16 flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground">
                <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
                REC
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 bg-background flex items-center justify-center gap-4">
            {!recordedBlob ? (
              <>
                {!isRecording ? (
                  <Button
                    size="lg"
                    className="rounded-full h-16 w-16 bg-destructive hover:bg-destructive/90"
                    onClick={startRecording}
                    disabled={hasPermission === false}
                  >
                    <Video className="h-6 w-6" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="rounded-full h-14 w-14"
                      onClick={pauseRecording}
                    >
                      {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="lg"
                      className="rounded-full h-16 w-16 bg-destructive hover:bg-destructive/90"
                      onClick={stopRecording}
                    >
                      <Square className="h-6 w-6 fill-current" />
                    </Button>
                  </>
                )}
              </>
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
                  Use Video
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
