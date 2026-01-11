/**
 * Gallery Lightbox
 * Full-screen photo viewer for public galleries
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  ZoomIn,
  ZoomOut,
  MessageCircle,
} from 'lucide-react';
import type { GalleryPhoto } from '@/hooks/usePublicGallery';
import { GalleryCommentsSection } from './GalleryCommentsSection';

interface GalleryLightboxProps {
  photos: GalleryPhoto[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
  allowDownload: boolean;
  allowComments?: boolean;
  shareToken?: string;
}

export function GalleryLightbox({
  photos,
  currentIndex,
  open,
  onOpenChange,
  onIndexChange,
  allowDownload,
  allowComments = false,
  shareToken,
}: GalleryLightboxProps) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentPhoto = photos[currentIndex];
  const hasNext = currentIndex < photos.length - 1;
  const hasPrev = currentIndex > 0;

  const goToNext = useCallback(() => {
    if (hasNext) {
      setIsLoading(true);
      onIndexChange(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onIndexChange]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setIsLoading(true);
      onIndexChange(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, goToNext, goToPrev, onOpenChange]);

  // Reset zoom when photo changes
  useEffect(() => {
    setIsZoomed(false);
  }, [currentIndex]);

  const handleDownload = async () => {
    if (!currentPhoto || !allowDownload) return;
    
    try {
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-${currentPhoto.id}.${currentPhoto.url.split('.').pop() || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  if (!currentPhoto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Navigation buttons */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            onClick={goToPrev}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        {hasNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12"
            onClick={goToNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}

        {/* Image container */}
        <div
          className={`w-full h-full flex items-center justify-center p-8 ${
            isZoomed ? 'cursor-zoom-out overflow-auto' : 'cursor-zoom-in'
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          {/* Loading spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}

          <img
            src={currentPhoto.url}
            alt={currentPhoto.description || 'Photo'}
            className={`transition-all duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            } ${
              isZoomed
                ? 'max-w-none max-h-none'
                : 'max-w-full max-h-full object-contain'
            }`}
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Bottom toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 rounded-full px-4 py-2">
          {/* Counter */}
          <span className="text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </span>

          {/* Zoom toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
          >
            {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </Button>

          {/* Comments toggle */}
          {allowComments && shareToken && (
            <Button
              variant="ghost"
              size="icon"
              className={`text-white hover:bg-white/20 h-8 w-8 ${showComments ? 'bg-white/20' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowComments(!showComments);
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          )}

          {/* Download */}
          {allowDownload && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Photo description */}
        {currentPhoto.description && !showComments && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-md text-center">
            <p className="text-white text-sm bg-black/60 rounded-lg px-4 py-2">
              {currentPhoto.description}
            </p>
          </div>
        )}

        {/* Comments section */}
        {showComments && allowComments && shareToken && (
          <div 
            className="absolute bottom-16 left-4 right-4 max-h-[50vh] overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <GalleryCommentsSection
              token={shareToken}
              mediaId={currentPhoto.id}
              allowComments={allowComments}
              isCollapsible={false}
              defaultExpanded={true}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
