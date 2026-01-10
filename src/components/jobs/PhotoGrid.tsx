import { useState, useCallback } from "react";
import { Star, Trash2, Loader2, ImageOff, Play, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useJobMedia, useSetCoverPhoto, useReorderMedia, type MediaCategory, type JobMedia, type MediaStatus } from "@/hooks/useJobMedia";
import { useDeletePhoto } from "@/hooks/useDeletePhoto";
import { useToast } from "@/hooks/use-toast";
import { PhotoLightbox } from "./PhotoLightbox";
import { formatDuration } from "@/lib/videoUtils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";

interface PhotoGridProps {
  jobId: string;
  onPhotoCountChange?: (count: number) => void;
}

// Extended type for optimistic entries (allows 'uploading' status)
type ExtendedMediaStatus = MediaStatus | 'uploading';
interface MediaItem extends Omit<JobMedia, 'status'> {
  status: ExtendedMediaStatus;
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

// Sortable Photo Item Component
function SortablePhotoItem({
  item,
  index,
  onSetCover,
  onDelete,
  onOpenLightbox,
}: {
  item: MediaItem;
  index: number;
  onSetCover: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenLightbox: (item: MediaItem, index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: item.status === 'uploading' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 10 : 1,
  };

  const isUploading = item.status === 'uploading';
  const isProcessing = item.status === 'processing';

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      layoutId={item.id}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "group relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer",
        (isProcessing || isUploading) && "opacity-80",
        isDragging && "opacity-50 ring-2 ring-primary shadow-xl"
      )}
      onClick={() => !isDragging && onOpenLightbox(item, index)}
    >
      {/* Drag handle - visible on hover */}
      {!isUploading && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </div>
      )}

      {/* Thumbnail - show video thumbnail or image */}
      {item.media_type === "video" ? (
        <div className="w-full h-full relative">
          <img
            src={item.thumbnail_url_md || item.url}
            alt={item.description || "Job video"}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          {/* Video play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
          {/* Duration badge */}
          {item.duration_seconds && (
            <Badge 
              variant="secondary" 
              className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 bg-black/70 text-white border-0"
            >
              {formatDuration(item.duration_seconds)}
            </Badge>
          )}
        </div>
      ) : (
        <img
          src={item.thumbnail_url_md || item.url}
          alt={item.description || "Job photo"}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      )}

      {/* Uploading shimmer overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]">
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && !isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Cover photo indicator */}
      {item.is_cover_photo && !isUploading && (
        <div className="absolute top-1 left-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 drop-shadow" />
        </div>
      )}

      {/* Category badge - only show for images (videos already have duration badge) */}
      {item.media_type !== "video" && !isUploading && (
        <div className="absolute bottom-1 left-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-foreground capitalize">
            {item.category}
          </span>
        </div>
      )}

      {/* Hover actions - don't show for uploading items */}
      {!isUploading && !isDragging && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          {item.media_type !== "video" && (
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onSetCover(item.id);
              }}
            >
              <Star className={cn(
                "h-4 w-4",
                item.is_cover_photo && "fill-yellow-400 text-yellow-400"
              )} />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// Drag overlay item (shown when dragging)
function DragOverlayItem({ item }: { item: MediaItem }) {
  return (
    <div className="aspect-square rounded-lg overflow-hidden bg-muted shadow-2xl ring-2 ring-primary">
      {item.media_type === "video" ? (
        <div className="w-full h-full relative">
          <img
            src={item.thumbnail_url_md || item.url}
            alt={item.description || "Job video"}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
        </div>
      ) : (
        <img
          src={item.thumbnail_url_md || item.url}
          alt={item.description || "Job photo"}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
}

export function PhotoGrid({ jobId, onPhotoCountChange }: PhotoGridProps) {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<MediaCategory | "all">("all");
  const [selectedPhoto, setSelectedPhoto] = useState<JobMedia | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaItem[] | null>(null);

  const { 
    media: fetchedMedia, 
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
  const reorderMedia = useReorderMedia();

  // Use local state for optimistic reordering, fallback to fetched
  const media = localMedia ?? (fetchedMedia as unknown as MediaItem[]) ?? [];

  // Sync local state with fetched when not dragging
  const syncMedia = useCallback(() => {
    if (!activeId && fetchedMedia) {
      setLocalMedia(fetchedMedia as unknown as MediaItem[]);
    }
  }, [activeId, fetchedMedia]);

  // Update local media when fetched changes (and not dragging)
  if (!activeId && fetchedMedia && localMedia !== fetchedMedia) {
    setLocalMedia(fetchedMedia as unknown as MediaItem[]);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = media.findIndex((item) => item.id === active.id);
    const newIndex = media.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newOrder = arrayMove(media, oldIndex, newIndex);
    setLocalMedia(newOrder);

    // Persist to database
    try {
      await reorderMedia.mutateAsync({
        mediaIds: newOrder.map((m) => m.id),
      });
    } catch (error) {
      // Revert on error
      setLocalMedia(fetchedMedia as unknown as MediaItem[]);
      toast({
        title: "Error",
        description: "Failed to save photo order.",
        variant: "destructive",
      });
    }
  };

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

  const openLightbox = (photo: MediaItem, index: number) => {
    // Don't open lightbox for uploading items
    if (photo.status === 'uploading') return;
    setSelectedPhoto(photo as JobMedia);
    setLightboxIndex(index);
  };

  const activeItem = activeId ? media.find((m) => m.id === activeId) : null;

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

      {/* Grid with Drag and Drop */}
      {media.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ImageOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
          <p className="text-xs text-muted-foreground/70">
            Use the Add Photo button to capture images
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              <AnimatePresence mode="popLayout">
                {media.map((item, index) => (
                  <SortablePhotoItem
                    key={item.id}
                    item={item}
                    index={index}
                    onSetCover={handleSetCover}
                    onDelete={handleDelete}
                    onOpenLightbox={openLightbox}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>

          <DragOverlay>
            {activeItem ? <DragOverlayItem item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <PhotoLightbox
          media={media.filter(m => m.status !== 'uploading') as unknown as JobMedia[]}
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
