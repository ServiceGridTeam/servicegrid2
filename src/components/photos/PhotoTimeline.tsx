import { useMemo, useState } from 'react';
import { Clock, Camera, MapPin } from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useJobMedia, type JobMedia } from '@/hooks/useJobMedia';
import { TagChip } from '@/components/tags/TagChip';
import { usePhotoTags } from '@/hooks/usePhotoTags';
import { PhotoLightbox } from '@/components/jobs/PhotoLightbox';
import { Skeleton } from '@/components/ui/skeleton';

interface PhotoTimelineProps {
  jobId: string;
  onPhotoClick?: (media: JobMedia) => void;
}

interface TimeGroup {
  hour: string;
  time: Date;
  photos: JobMedia[];
}

function PhotoTimelineItem({ 
  media, 
  onClick 
}: { 
  media: JobMedia; 
  onClick: () => void;
}) {
  const { data: tags = [] } = usePhotoTags(media.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
    >
      <img
        src={media.thumbnail_url_md || media.url}
        alt={media.description || 'Photo'}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      
      {/* Category badge */}
      <div className="absolute bottom-1 left-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 text-foreground capitalize">
          {media.category}
        </span>
      </div>

      {/* GPS indicator */}
      {media.latitude && media.longitude && (
        <div className="absolute top-1 right-1">
          <MapPin className="h-3 w-3 text-white drop-shadow" />
        </div>
      )}

      {/* Tags on hover */}
      {tags.length > 0 && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
          <div className="flex flex-wrap gap-0.5">
            {tags.slice(0, 2).map(t => t.tag && (
              <TagChip
                key={t.id}
                name={t.tag.name}
                color={t.tag.color}
                size="sm"
              />
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-white/80 px-1">
                +{tags.length - 2}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  );
}

export function PhotoTimeline({ jobId, onPhotoClick }: PhotoTimelineProps) {
  const { media, isLoading } = useJobMedia({ jobId });
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Group photos by hour
  const timeGroups = useMemo(() => {
    if (!media.length) return [];

    const groups: TimeGroup[] = [];
    let currentGroup: TimeGroup | null = null;

    // Sort by captured_at
    const sorted = [...media].sort((a, b) => {
      const dateA = a.captured_at ? new Date(a.captured_at).getTime() : 0;
      const dateB = b.captured_at ? new Date(b.captured_at).getTime() : 0;
      return dateA - dateB;
    });

    sorted.forEach((photo) => {
      const capturedAt = photo.captured_at 
        ? parseISO(photo.captured_at)
        : new Date(photo.created_at);
      
      const hourKey = format(capturedAt, 'yyyy-MM-dd HH:00');

      if (!currentGroup || currentGroup.hour !== hourKey) {
        currentGroup = {
          hour: hourKey,
          time: capturedAt,
          photos: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.photos.push(photo);
    });

    return groups;
  }, [media]);

  const handlePhotoClick = (photo: JobMedia, globalIndex: number) => {
    if (onPhotoClick) {
      onPhotoClick(photo);
    } else {
      setLightboxIndex(globalIndex);
      setLightboxOpen(true);
    }
  };

  // Calculate global index for each photo
  const flatMedia = useMemo(() => {
    return timeGroups.flatMap(g => g.photos);
  }, [timeGroups]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-16 h-6" />
            <div className="flex-1 grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!media.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Camera className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No photos captured yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[3.5rem] top-0 bottom-0 w-px bg-border" />

      <div className="space-y-6">
        {timeGroups.map((group, groupIndex) => {
          // Calculate time gap from previous group
          const prevGroup = groupIndex > 0 ? timeGroups[groupIndex - 1] : null;
          const timeDiff = prevGroup 
            ? differenceInMinutes(group.time, prevGroup.time)
            : 0;

          const showGap = timeDiff > 60; // Show gap indicator if > 1 hour

          return (
            <div key={group.hour}>
              {/* Time gap indicator */}
              {showGap && (
                <div className="flex items-center gap-2 pl-[4.5rem] mb-4 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border border-dashed" />
                  <span>
                    {timeDiff > 60 * 24 
                      ? `${Math.floor(timeDiff / (60 * 24))} days later`
                      : `${Math.floor(timeDiff / 60)} hours later`
                    }
                  </span>
                  <div className="h-px flex-1 bg-border border-dashed" />
                </div>
              )}

              <div className="flex gap-4">
                {/* Time marker */}
                <div className="flex-shrink-0 w-14 text-right">
                  <div className="relative">
                    <span className="text-xs font-medium">
                      {format(group.time, 'h:mm a')}
                    </span>
                    {/* Timeline dot */}
                    <div className="absolute right-[-1.125rem] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
                  </div>
                </div>

                {/* Photos grid */}
                <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {group.photos.map((photo) => {
                    const globalIndex = flatMedia.indexOf(photo);
                    return (
                      <PhotoTimelineItem
                        key={photo.id}
                        media={photo}
                        onClick={() => handlePhotoClick(photo, globalIndex)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        media={flatMedia}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}