import { useState } from "react";
import { Star, Trash2, Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobMedia, useSetCoverPhoto, type MediaCategory, type JobMedia } from "@/hooks/useJobMedia";
import { useDeletePhoto } from "@/hooks/useDeletePhoto";
import { useToast } from "@/hooks/use-toast";
import { PhotoLightbox } from "./PhotoLightbox";

interface PhotoGridProps {
  jobId: string;
  onPhotoCountChange?: (count: number) => void;
}

const CATEGORY_TABS: { value: MediaCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damage", label: "Damage" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

export function PhotoGrid({ jobId, onPhotoCountChange }: PhotoGridProps) {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<MediaCategory | "all">("all");
  const [selectedPhoto, setSelectedPhoto] = useState<JobMedia | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const { 
    media, 
    isLoading, 
    coverPhoto,
    photoCount,
    videoCount 
  } = useJobMedia({ 
    jobId, 
    category: activeCategory === "all" ? undefined : activeCategory 
  });

  const setCoverPhoto = useSetCoverPhoto();
  const deletePhoto = useDeletePhoto();

  const handleSetCover = async (mediaId: string) => {
    try {
      await setCoverPhoto.mutateAsync({ jobId, mediaId });
      toast({
        title: "Cover photo updated",
        description: "This photo is now the cover for this job.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set cover photo.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (mediaId: string) => {
    const media_ = media?.find(m => m.id === mediaId);
    if (!media_) return;

    try {
      await deletePhoto.mutateAsync({ mediaId, jobId });
      toast({
        title: "Photo deleted",
        description: "The photo has been removed.",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement undo functionality
              toast({ title: "Undo not yet implemented" });
            }}
          >
            Undo
          </Button>
        ),
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete photo.",
        variant: "destructive",
      });
    }
  };

  const openLightbox = (photo: JobMedia, index: number) => {
    setSelectedPhoto(photo);
    setLightboxIndex(index);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const filteredMedia = media || [];

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as MediaCategory | "all")}
      >
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          {CATEGORY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="text-xs px-2 py-1"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{photoCount} photos</span>
        {videoCount > 0 && <span>{videoCount} videos</span>}
      </div>

      {/* Grid */}
      {filteredMedia.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ImageOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
          <p className="text-xs text-muted-foreground/70">
            Use the Add Photo button to capture images
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredMedia.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer",
                item.status === "processing" && "opacity-60"
              )}
              onClick={() => openLightbox(item, index)}
            >
              {/* Thumbnail */}
              <img
                src={item.thumbnail_url_md || item.url}
                alt={item.description || "Job photo"}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />

              {/* Processing overlay */}
              {item.status === "processing" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {/* Cover photo indicator */}
              {item.is_cover_photo && (
                <div className="absolute top-1 left-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
                </div>
              )}

              {/* Category badge */}
              <div className="absolute bottom-1 left-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-foreground capitalize">
                  {item.category}
                </span>
              </div>

              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetCover(item.id);
                  }}
                >
                  <Star className={cn(
                    "h-4 w-4",
                    item.is_cover_photo && "fill-yellow-400 text-yellow-400"
                  )} />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <PhotoLightbox
          media={filteredMedia}
          initialIndex={lightboxIndex}
          open={!!selectedPhoto}
          onOpenChange={(open) => !open && setSelectedPhoto(null)}
          onSetCover={handleSetCover}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
