import { Star, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobMedia, type JobMedia } from "@/hooks/useJobMedia";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaGalleryPreviewProps {
  jobId: string;
  maxItems?: number;
  onViewAll?: () => void;
  className?: string;
}

export function MediaGalleryPreview({
  jobId,
  maxItems = 5,
  onViewAll,
  className,
}: MediaGalleryPreviewProps) {
  const { media, isLoading, coverPhoto, photoCount } = useJobMedia({ jobId });

  if (isLoading) {
    return (
      <div className={cn("flex gap-2", className)}>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-16 rounded-lg flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (!media || media.length === 0) {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground py-2",
          className
        )}
      >
        <ImageIcon className="h-4 w-4" />
        <span>No photos</span>
      </div>
    );
  }

  // Sort to put cover photo first
  const sortedMedia = [...media].sort((a, b) => {
    if (a.is_cover_photo) return -1;
    if (b.is_cover_photo) return 1;
    return 0;
  });

  const displayMedia = sortedMedia.slice(0, maxItems);
  const remainingCount = photoCount - maxItems;

  return (
    <div 
      className={cn("flex gap-2 overflow-x-auto scrollbar-hide", className)}
      onClick={onViewAll}
    >
      {displayMedia.map((item) => (
        <div
          key={item.id}
          className={cn(
            "relative h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 cursor-pointer",
            "hover:ring-2 hover:ring-primary/50 transition-all"
          )}
        >
          <img
            src={item.thumbnail_url_sm || item.thumbnail_url_md || item.url}
            alt={item.description || "Job photo"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {item.is_cover_photo && (
            <div className="absolute top-0.5 left-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 drop-shadow" />
            </div>
          )}
        </div>
      ))}
      
      {remainingCount > 0 && (
        <div
          className={cn(
            "h-16 w-16 rounded-lg bg-muted flex-shrink-0 cursor-pointer",
            "flex items-center justify-center text-sm font-medium text-muted-foreground",
            "hover:bg-muted/80 transition-colors"
          )}
          onClick={onViewAll}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
