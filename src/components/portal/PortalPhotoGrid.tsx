/**
 * Portal-specific photo grid that automatically uses privacy-safe URLs
 * with GPS and sensitive EXIF data stripped
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortalMedia } from '@/hooks/usePortalMedia';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface PortalPhotoGridProps {
  jobId: string;
  businessId: string;
}

interface MediaItem {
  id: string;
  media_type: string;
  thumbnail_url_sm: string | null;
  thumbnail_url_md: string | null;
  blurhash: string | null;
  description: string | null;
}

export function PortalPhotoGrid({ jobId, businessId }: PortalPhotoGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Fetch media for the job
  const { data: media, isLoading } = useQuery({
    queryKey: ['portal-job-media', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_media')
        .select('id, media_type, thumbnail_url_sm, thumbnail_url_md, blurhash, description')
        .eq('job_id', jobId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as MediaItem[];
    },
    enabled: !!jobId,
  });

  // Get privacy-safe URLs for all media
  const mediaIds = media?.map(m => m.id) || [];
  const { urls: strippedUrls, isLoading: isLoadingUrls } = usePortalMedia({
    mediaIds,
    context: 'portal',
  });

  const handleNext = () => {
    if (selectedIndex !== null && media) {
      setSelectedIndex((selectedIndex + 1) % media.length);
    }
  };

  const handlePrev = () => {
    if (selectedIndex !== null && media) {
      setSelectedIndex((selectedIndex - 1 + media.length) % media.length);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (!media || media.length === 0) {
    return null;
  }

  const selectedMedia = selectedIndex !== null ? media[selectedIndex] : null;
  const selectedUrl = selectedMedia ? strippedUrls.get(selectedMedia.id) : null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image className="h-4 w-4" />
          <span>{media.length} photo{media.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {media.map((item, index) => {
            const strippedUrl = strippedUrls.get(item.id);
            const thumbnailSrc = strippedUrl || item.thumbnail_url_sm;

            return (
              <motion.button
                key={item.id}
                className="relative aspect-square rounded-md overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                onClick={() => setSelectedIndex(index)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoadingUrls ? (
                  <div className="absolute inset-0 animate-pulse bg-muted" />
                ) : thumbnailSrc ? (
                  <img
                    src={thumbnailSrc}
                    alt={item.description || `Job photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <Image className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {item.media_type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/50 rounded-full p-2">
                      <Play className="h-4 w-4 text-white" fill="white" />
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <VisuallyHidden>
            <DialogTitle>Photo viewer</DialogTitle>
          </VisuallyHidden>
          
          <div className="relative">
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={() => setSelectedIndex(null)}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Navigation */}
            {media.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Media display */}
            <AnimatePresence mode="wait">
              {selectedMedia && (
                <motion.div
                  key={selectedMedia.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center min-h-[400px] max-h-[80vh]"
                >
                  {selectedMedia.media_type === 'video' ? (
                    <video
                      src={selectedUrl || undefined}
                      controls
                      className="max-w-full max-h-[80vh] object-contain"
                    />
                  ) : (
                    <img
                      src={selectedUrl || selectedMedia.thumbnail_url_md || undefined}
                      alt={selectedMedia.description || 'Job photo'}
                      className="max-w-full max-h-[80vh] object-contain"
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Caption */}
            {selectedMedia?.description && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white text-sm">{selectedMedia.description}</p>
              </div>
            )}

            {/* Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
              {(selectedIndex ?? 0) + 1} / {media.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
