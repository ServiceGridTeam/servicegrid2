import { useState, useEffect } from "react";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Trash2, 
  Download,
  MapPin,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { JobMedia } from "@/hooks/useJobMedia";

interface PhotoLightboxProps {
  media: JobMedia[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetCover?: (mediaId: string) => void;
  onDelete?: (mediaId: string) => void;
}

export function PhotoLightbox({
  media,
  initialIndex,
  open,
  onOpenChange,
  onSetCover,
  onDelete,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  const currentMedia = media[currentIndex];
  if (!currentMedia) return null;

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : media.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < media.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(currentMedia.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `photo-${currentMedia.id}.${currentMedia.file_extension || "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === "Escape") onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none"
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Navigation arrows */}
        {media.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={goToPrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
              onClick={goToNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          </>
        )}

        {/* Main image */}
        <div className="flex items-center justify-center min-h-[60vh] p-8">
          {currentMedia.media_type === "video" ? (
            <video
              src={currentMedia.url}
              controls
              className="max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <img
              src={currentMedia.url}
              alt={currentMedia.description || "Job photo"}
              className="max-w-full max-h-[70vh] object-contain"
            />
          )}
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-end justify-between">
            {/* Photo info */}
            <div className="text-white space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {currentMedia.category}
                </Badge>
                {currentMedia.is_cover_photo && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Cover
                  </Badge>
                )}
              </div>
              
              {currentMedia.description && (
                <p className="text-sm text-white/80">{currentMedia.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-white/60">
                {currentMedia.captured_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(currentMedia.captured_at), "MMM d, yyyy h:mm a")}
                  </span>
                )}
                {currentMedia.latitude && currentMedia.longitude && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    GPS captured
                  </span>
                )}
              </div>

              {/* Counter */}
              <p className="text-xs text-white/50">
                {currentIndex + 1} of {media.length}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              {onSetCover && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-white hover:bg-white/20",
                    currentMedia.is_cover_photo && "text-yellow-300"
                  )}
                  onClick={() => onSetCover(currentMedia.id)}
                >
                  <Star className={cn(
                    "h-4 w-4 mr-1",
                    currentMedia.is_cover_photo && "fill-current"
                  )} />
                  {currentMedia.is_cover_photo ? "Cover" : "Set Cover"}
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
                  onClick={() => {
                    onDelete(currentMedia.id);
                    if (media.length === 1) {
                      onOpenChange(false);
                    } else if (currentIndex >= media.length - 1) {
                      setCurrentIndex(currentIndex - 1);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
