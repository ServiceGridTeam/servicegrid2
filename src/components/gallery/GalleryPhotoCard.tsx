/**
 * Gallery Photo Card
 * Individual photo card for public gallery view
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, MessageCircle } from 'lucide-react';
import type { GalleryPhoto } from '@/hooks/usePublicGallery';

interface GalleryPhotoCardProps {
  photo: GalleryPhoto;
  allowDownload: boolean;
  allowComments: boolean;
  onClick: () => void;
  onDownload?: () => void;
  onCommentClick?: () => void;
}

export function GalleryPhotoCard({
  photo,
  allowDownload,
  allowComments,
  onClick,
  onDownload,
  onCommentClick,
}: GalleryPhotoCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!allowDownload) return;
    
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-${photo.id}.${photo.url.split('.').pop() || 'jpg'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onDownload?.();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCommentClick?.();
  };

  return (
    <div
      className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Placeholder skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}

      {/* Image */}
      <img
        src={photo.thumbnail_url_md || photo.thumbnail_url_lg || photo.url}
        alt={photo.description || 'Photo'}
        className={`w-full aspect-square object-cover transition-all duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${isHovered ? 'scale-105' : 'scale-100'}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />

      {/* Overlay on hover */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 flex items-center justify-center ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <ZoomIn className="h-8 w-8 text-white" />
      </div>

      {/* Action buttons */}
      <div
        className={`absolute bottom-2 right-2 flex gap-1 transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {allowComments && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={handleCommentClick}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}
        {allowDownload && (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Category badge */}
      {photo.category && photo.category !== 'other' && (
        <div className="absolute top-2 left-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-black/50 text-white capitalize">
            {photo.category.replace('_', ' ')}
          </span>
        </div>
      )}
    </div>
  );
}
