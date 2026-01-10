import { useRef, useState } from "react";
import { Camera, ChevronDown, ImagePlus, CloudOff, Loader2, RefreshCw, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUploadPhoto } from "@/hooks/useUploadPhoto";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { useToast } from "@/hooks/use-toast";
import type { MediaCategory } from "@/hooks/useJobMedia";
import { cn } from "@/lib/utils";
import { isHeicFile } from "@/lib/heicConverter";
import { VideoRecordButton } from "./VideoRecordButton";
import { isVideoRecordingSupported } from "@/lib/videoUtils";

interface PhotoCaptureButtonProps {
  jobId: string;
  pendingCount?: number;
  variant?: "default" | "floating";
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
}

const CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damage", label: "Damage" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

export function PhotoCaptureButton({
  jobId,
  pendingCount = 0,
  variant = "default",
  onUploadStart,
  onUploadComplete,
}: PhotoCaptureButtonProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory>("general");
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const uploadPhoto = useUploadPhoto();
  const { status: queueStatus, isOnline, queueUpload } = useUploadQueue();
  const supportsVideoRecording = isVideoRecordingSupported();

  // Combined pending count from props and queue
  const totalPending = pendingCount + queueStatus.pendingCount + queueStatus.uploadingCount;

  const handleVideoRecorded = async (file: File, _thumbnailBlob: Blob, durationSeconds: number) => {
    onUploadStart?.();
    setIsUploading(true);

    try {
      if (isOnline) {
        await uploadPhoto.mutateAsync({
          file,
          jobId,
          category: selectedCategory,
          durationSeconds,
        });
      } else {
        const result = await queueUpload({
          file,
          jobId,
          category: selectedCategory,
        });
        
        if (result.success) {
          toast({
            title: "Video queued",
            description: "Video will upload when you're back online",
          });
        }
      }
    } catch (error) {
      console.error("Video upload failed:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload video",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      onUploadComplete?.();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    onUploadStart?.();
    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        // Check if HEIC conversion is needed and show converting state
        const needsConversion = await isHeicFile(file);
        if (needsConversion) {
          setIsConverting(true);
          toast({
            title: "Converting photo...",
            description: "Converting HEIC format for compatibility",
          });
        }

        if (isOnline) {
          // Direct upload when online (HEIC conversion happens in hook)
          await uploadPhoto.mutateAsync({
            file,
            jobId,
            category: selectedCategory,
          });
          
          if (needsConversion) {
            setIsConverting(false);
          }
        } else {
          // Queue for later when offline
          const result = await queueUpload({
            file,
            jobId,
            category: selectedCategory,
          });
          
          if (result.success) {
            toast({
              title: "Photo queued",
              description: `${file.name} will upload when you're back online`,
            });
          }
          
          if (needsConversion) {
            setIsConverting(false);
          }
        }
      } catch (error) {
        console.error("Upload failed:", error);
        setIsConverting(false);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    setIsUploading(false);
    onUploadComplete?.();
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCategorySelect = (category: MediaCategory) => {
    setSelectedCategory(category);
    fileInputRef.current?.click();
  };

  // Floating variant - show video button alongside
  if (variant === "floating") {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        
        {/* Video record button - positioned above camera button */}
        {supportsVideoRecording && isOnline && (
          <div className="fixed bottom-24 right-6 z-50">
            <VideoRecordButton
              onVideoRecorded={handleVideoRecorded}
              disabled={isUploading || isConverting}
            />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className={cn(
                "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
                !isOnline && "bg-muted"
              )}
              disabled={isUploading || isConverting}
            >
              {isConverting ? (
                <RefreshCw className="h-6 w-6 animate-spin" />
              ) : isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : !isOnline ? (
                <CloudOff className="h-6 w-6" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
              {totalPending > 0 && (
                <Badge
                  variant={isOnline ? "destructive" : "secondary"}
                  className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full px-1 text-xs"
                >
                  {totalPending}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!isOnline && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
                Offline - photos will queue
              </div>
            )}
            {CATEGORIES.map((cat) => (
              <DropdownMenuItem
                key={cat.value}
                onClick={() => handleCategorySelect(cat.value)}
              >
                {cat.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      
      {/* Video recording button for default variant */}
      {supportsVideoRecording && isOnline && (
        <VideoRecordButton
          onVideoRecorded={handleVideoRecorded}
          disabled={isUploading || isConverting}
        />
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={cn("gap-2", !isOnline && "border-muted-foreground/50")}
            disabled={isUploading || isConverting}
          >
            {isConverting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !isOnline ? (
              <CloudOff className="h-4 w-4" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {isConverting ? "Converting..." : isOnline ? "Add Photo" : "Queue Photo"}
            {totalPending > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalPending}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {!isOnline && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-b mb-1">
              Offline - photos will queue
            </div>
          )}
          {CATEGORIES.map((cat) => (
            <DropdownMenuItem
              key={cat.value}
              onClick={() => handleCategorySelect(cat.value)}
            >
              {cat.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
