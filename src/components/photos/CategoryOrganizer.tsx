import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useJobMedia, useUpdateMediaCategory, type JobMedia, type MediaCategory } from '@/hooks/useJobMedia';
import { useToast } from '@/hooks/use-toast';
import { PhotoLightbox } from '@/components/jobs/PhotoLightbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera } from 'lucide-react';

interface CategoryOrganizerProps {
  jobId: string;
}

const CATEGORIES: { value: MediaCategory; label: string; color: string }[] = [
  { value: 'before', label: 'Before', color: 'bg-blue-500/10 border-blue-500/30' },
  { value: 'during', label: 'During', color: 'bg-yellow-500/10 border-yellow-500/30' },
  { value: 'after', label: 'After', color: 'bg-green-500/10 border-green-500/30' },
  { value: 'damage', label: 'Damage', color: 'bg-red-500/10 border-red-500/30' },
  { value: 'equipment', label: 'Equipment', color: 'bg-purple-500/10 border-purple-500/30' },
  { value: 'materials', label: 'Materials', color: 'bg-orange-500/10 border-orange-500/30' },
  { value: 'general', label: 'General', color: 'bg-gray-500/10 border-gray-500/30' },
];

function CategoryColumn({
  category,
  photos,
  onPhotoClick,
}: {
  category: typeof CATEGORIES[number];
  photos: JobMedia[];
  onPhotoClick: (photo: JobMedia, allPhotos: JobMedia[]) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: category.value,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-40 md:w-48 rounded-lg border-2 transition-all',
        category.color,
        isOver && 'ring-2 ring-primary border-primary'
      )}
    >
      {/* Column header */}
      <div className="p-2 border-b flex items-center justify-between">
        <span className="font-medium text-sm">{category.label}</span>
        <Badge variant="secondary" className="text-xs">
          {photos.length}
        </Badge>
      </div>

      {/* Photos */}
      <ScrollArea className="h-[400px]">
        <SortableContext items={photos.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="p-2 space-y-2">
            {photos.map((photo) => (
              <DraggablePhoto
                key={photo.id}
                photo={photo}
                onClick={() => onPhotoClick(photo, photos)}
              />
            ))}
            {photos.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Drop photos here
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

function DraggablePhoto({
  photo,
  onClick,
}: {
  photo: JobMedia;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(
        'relative rounded-md overflow-hidden cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 ring-2 ring-primary'
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <img
        src={photo.thumbnail_url_sm || photo.url}
        alt={photo.description || 'Photo'}
        className="w-full aspect-video object-cover"
        loading="lazy"
        draggable={false}
      />
    </motion.div>
  );
}

function DragOverlayPhoto({ photo }: { photo: JobMedia }) {
  return (
    <div className="w-40 rounded-md overflow-hidden shadow-2xl ring-2 ring-primary">
      <img
        src={photo.thumbnail_url_sm || photo.url}
        alt=""
        className="w-full aspect-video object-cover"
      />
    </div>
  );
}

export function CategoryOrganizer({ jobId }: CategoryOrganizerProps) {
  const { toast } = useToast();
  const { media, isLoading } = useJobMedia({ jobId });
  const updateCategory = useUpdateMediaCategory();
  
  const [activePhoto, setActivePhoto] = useState<JobMedia | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<JobMedia[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Group photos by category
  const photosByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = media.filter(m => m.category === cat.value);
    return acc;
  }, {} as Record<MediaCategory, JobMedia[]>);

  const handleDragStart = (event: DragStartEvent) => {
    const photo = media.find(m => m.id === event.active.id);
    setActivePhoto(photo || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActivePhoto(null);

    const { active, over } = event;
    if (!over) return;

    const photoId = active.id as string;
    const newCategory = over.id as MediaCategory;
    
    const photo = media.find(m => m.id === photoId);
    if (!photo || photo.category === newCategory) return;

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);

    try {
      await updateCategory.mutateAsync({
        mediaId: photoId,
        category: newCategory,
      });
      toast({
        title: 'Category updated',
        description: `Photo moved to ${newCategory}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update category',
        variant: 'destructive',
      });
    }
  };

  const handlePhotoClick = (photo: JobMedia, categoryPhotos: JobMedia[]) => {
    setLightboxMedia(categoryPhotos);
    setLightboxIndex(categoryPhotos.indexOf(photo));
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4">
        {CATEGORIES.slice(0, 4).map((cat) => (
          <div key={cat.value} className="flex-shrink-0 w-40">
            <Skeleton className="h-10 w-full mb-2 rounded-lg" />
            <Skeleton className="h-[400px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (!media.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Camera className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No photos to organize</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {CATEGORIES.map((category) => (
            <CategoryColumn
              key={category.value}
              category={category}
              photos={photosByCategory[category.value]}
              onPhotoClick={handlePhotoClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activePhoto && <DragOverlayPhoto photo={activePhoto} />}
        </DragOverlay>
      </DndContext>

      <PhotoLightbox
        media={lightboxMedia}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}