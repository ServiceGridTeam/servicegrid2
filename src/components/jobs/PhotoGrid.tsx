import { useState, useCallback, useEffect, useMemo } from "react";
import { Star, Trash2, Loader2, ImageOff, Play, GripVertical, CheckSquare, Square, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useJobMedia, useSetCoverPhoto, useReorderMedia, type MediaCategory, type JobMedia, type MediaStatus } from "@/hooks/useJobMedia";
import { usePhotoTags } from "@/hooks/usePhotoTags";
import { useDeletePhoto } from "@/hooks/useDeletePhoto";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { PhotoLightbox } from "./PhotoLightbox";
import { BulkTagDialog } from "@/components/tags/BulkTagDialog";
import { TagChip } from "@/components/tags/TagChip";
import { formatDuration } from "@/lib/videoUtils";
import { decodeBlurhash } from "@/lib/thumbnailGenerator";
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
  blurhash?: string | null;
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

// Blurhash placeholder component
function BlurhashPlaceholder({ hash, className }: { hash: string; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  
  useEffect(() => {
    if (hash) {
      decodeBlurhash(hash, 32, 32).then(setDataUrl);
    }
  }, [hash]);
  
  if (!dataUrl) return null;
  
  return (
    <img
      src={dataUrl}
      alt=""
      className={cn("absolute inset-0 w-full h-full object-cover", className)}
      style={{ filter: 'blur(20px)', transform: 'scale(1.2)' }}
    />
  );
}

// Photo tags overlay (shows on hover)
function PhotoTagsOverlay({ mediaId }: { mediaId: string }) {
  const { data: tags = [] } = usePhotoTags(mediaId);
  
  if (!tags.length) return null;
  
  return (
    <div className="absolute bottom-6 left-1 right-1 flex flex-wrap gap-0.5 pointer-events-none">
      {tags.slice(0, 2).map(t => t.tag && (
        <TagChip
          key={t.id}
          name={t.tag.name}
          color={t.tag.color}
          size="sm"
          className="text-[9px] px-1 py-0"
        />
      ))}
      {tags.length > 2 && (
        <span className="text-[9px] text-white bg-black/50 px-1 rounded">
          +{tags.length - 2}
        </span>
      )}
    </div>
  );
}

// Sortable Photo Item Component
function SortablePhotoItem({
  item,
  index,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onSetCover,
  onDelete,
  onOpenLightbox,
}: {
  item: MediaItem;
  index: number;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
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
  } = useSortable({ id: item.id, disabled: item.status === 'uploading' || isSelectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 10 : 1,
  };

  const isUploading = item.status === 'uploading';
  const isProcessing = item.status === 'processing';

  const handleClick = () => {
    if (isDragging) return;
    if (isSelectMode) {
      onToggleSelect(item.id);
      if (navigator.vibrate) navigator.vibrate(5);
    } else {
      onOpenLightbox(item, index);
    }
  };

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
        isDragging && "opacity-50 ring-2 ring-primary shadow-xl",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      {isSelectMode && (
        <div className="absolute top-1 left-1 z-20">
          {isSelected ? (
            <CheckSquare className="h-5 w-5 text-primary fill-primary/20" />
          ) : (
            <Square className="h-5 w-5 text-white/80 drop-shadow" />
          )}
        </div>
      )}

      {/* Drag handle - visible on hover (not in select mode) */}
      {!isUploading && !isSelectMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </div>
      )}

      {/* Blurhash placeholder - show while image loads */}
      {item.blurhash && (
        <BlurhashPlaceholder hash={item.blurhash} />
      )}
      
      {/* Thumbnail - show video thumbnail or image */}
      {item.media_type === "video" ? (
        <div className="w-full h-full relative">
          <img
            src={item.thumbnail_url_md || item.url}
            alt={item.description || "Job video"}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 relative z-[1]"
            loading="lazy"
          />
          {/* Video play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[2]">
            <div className="h-10 w-10 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="h-5 w-5 text-white fill-white" />
            </div>
          </div>
          {/* Duration badge */}
          {item.duration_seconds && (
            <Badge 
              variant="secondary" 
              className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 bg-black/70 text-white border-0 z-[2]"
            >
              {formatDuration(item.duration_seconds)}
            </Badge>
          )}
        </div>
      ) : (
        <img
          src={item.thumbnail_url_md || item.url}
          alt={item.description || "Job photo"}
          className="w-full h-full object-cover transition-transform group-hover:scale-105 relative z-[1]"
          loading="lazy"
          onLoad={(e) => {
            // Fade in when loaded
            (e.target as HTMLImageElement).style.opacity = '1';
          }}
          style={{ opacity: item.blurhash ? 0 : 1, transition: 'opacity 300ms ease-in-out' }}
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

      {/* Tags overlay on hover */}
      {!isSelectMode && !isUploading && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <PhotoTagsOverlay mediaId={item.id} />
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

      {/* Hover actions - don't show for uploading items or in select mode */}
      {!isUploading && !isDragging && !isSelectMode && (
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
  
  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);

  // Permission check - technician+ can tag photos
  const { allowed: canTag } = usePermission('technician');

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    const selectableIds = media.filter(m => m.status !== 'uploading').map(m => m.id);
    setSelectedIds(selectableIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setIsSelectMode(false);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    
    for (const id of selectedIds) {
      await deletePhoto.mutateAsync({ mediaId: id, jobId });
    }
    
    toast({
      title: `${selectedIds.length} photos deleted`,
      description: "Selected photos have been removed.",
    });
    
    clearSelection();
  };

  const activeItem = activeId ? media.find((m) => m.id === activeId) : null;

  const selectedThumbnails = useMemo(() => 
    media
      .filter(m => selectedIds.includes(m.id))
      .map(m => ({ id: m.id, url: m.thumbnail_url_sm || m.url || '' })),
    [media, selectedIds]
  );

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
      {/* Header with Category Tabs and Select Mode */}
      <div className="flex items-center gap-2 justify-between">
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as MediaCategory | "all")}
          className="flex-1"
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
        
        <Button
          variant={isSelectMode ? "secondary" : "outline"}
          size="sm"
          onClick={() => {
            if (isSelectMode) {
              clearSelection();
            } else {
              setIsSelectMode(true);
            }
          }}
        >
          {isSelectMode ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </>
          ) : (
            <>
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              Select
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{photoCount} photos</span>
        {videoCount > 0 && <span>{videoCount} videos</span>}
        {isSelectMode && selectedIds.length > 0 && (
          <Badge variant="secondary">{selectedIds.length} selected</Badge>
        )}
      </div>

      {/* Floating action bar when photos selected */}
      <AnimatePresence>
        {isSelectMode && selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-full px-4 py-2 flex items-center gap-2"
          >
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <div className="w-px h-6 bg-border" />
            <Button size="sm" variant="ghost" onClick={selectAll}>
              Select All
            </Button>
            {canTag && (
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setBulkTagDialogOpen(true)}
              >
                <TagIcon className="h-4 w-4 mr-1" />
                Tag
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-destructive"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

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
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={toggleSelect}
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

      {/* Bulk Tag Dialog */}
      <BulkTagDialog
        open={bulkTagDialogOpen}
        onOpenChange={setBulkTagDialogOpen}
        selectedMediaIds={selectedIds}
        thumbnails={selectedThumbnails}
        onComplete={clearSelection}
      />
    </div>
  );
}