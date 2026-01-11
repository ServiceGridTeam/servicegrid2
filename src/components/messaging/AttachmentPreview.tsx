/**
 * AttachmentPreview component
 * Displays file attachments with thumbnails, download, and preview capabilities
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Video,
  File,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize, type Attachment } from '@/lib/messageUtils';

interface AttachmentPreviewProps {
  attachments: Attachment[];
  isOwn?: boolean;
  className?: string;
}

interface SingleAttachmentProps {
  attachment: Attachment;
  isOwn?: boolean;
  onClick?: () => void;
}

function getFileIcon(type: Attachment['type']) {
  switch (type) {
    case 'image':
      return ImageIcon;
    case 'video':
      return Video;
    default:
      return FileText;
  }
}

function SingleAttachment({ attachment, isOwn, onClick }: SingleAttachmentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const Icon = getFileIcon(attachment.type);
  const isPending = attachment.processingStatus === 'pending' || attachment.processingStatus === 'processing';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (attachment.type === 'image') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative group cursor-pointer"
        onClick={onClick}
      >
        <div className="relative overflow-hidden rounded-lg max-w-[240px]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {hasError ? (
            <div className="flex items-center justify-center w-[120px] h-[80px] bg-muted rounded-lg">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          ) : (
            <img
              src={attachment.thumbnailUrl || attachment.url}
              alt={attachment.name}
              className={cn(
                'max-h-[200px] object-cover rounded-lg transition-opacity',
                isLoading && 'opacity-0'
              )}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-6 w-6 bg-background/80 backdrop-blur-sm"
            onClick={handleDownload}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </motion.div>
    );
  }

  if (attachment.type === 'video') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative group"
      >
        <video
          src={attachment.url}
          className="max-h-[200px] max-w-[240px] rounded-lg"
          controls
          preload="metadata"
        />
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </motion.div>
    );
  }

  // File attachment
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg max-w-[280px]',
        isOwn ? 'bg-primary-foreground/10' : 'bg-muted'
      )}
    >
      <div className="shrink-0">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" title={attachment.name}>
          {attachment.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleDownload}
      >
        <Download className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}

export function AttachmentPreview({ attachments, isOwn, className }: AttachmentPreviewProps) {
  const [previewImage, setPreviewImage] = useState<Attachment | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <>
      <div className={cn('flex flex-wrap gap-2 mt-2', className)}>
        {attachments.map((attachment) => (
          <SingleAttachment
            key={attachment.id}
            attachment={attachment}
            isOwn={isOwn}
            onClick={attachment.type === 'image' ? () => setPreviewImage(attachment) : undefined}
          />
        ))}
      </div>

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {previewImage?.name || 'Image preview'}
          </DialogTitle>
          {previewImage && (
            <div className="relative">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-background/80 backdrop-blur-sm"
                  onClick={() => window.open(previewImage.url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-background/80 backdrop-blur-sm"
                  onClick={() => setPreviewImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/80 to-transparent">
                <p className="text-sm font-medium">{previewImage.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(previewImage.size)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
