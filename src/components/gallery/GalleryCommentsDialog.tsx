/**
 * Gallery Comments Dialog
 * Modal wrapper for the comments moderation panel
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GalleryCommentsModeration } from './GalleryCommentsModeration';

interface GalleryCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  shareId?: string;
}

export function GalleryCommentsDialog({
  open,
  onOpenChange,
  jobId,
  shareId,
}: GalleryCommentsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gallery Comments</DialogTitle>
        </DialogHeader>
        <GalleryCommentsModeration jobId={jobId} shareId={shareId} />
      </DialogContent>
    </Dialog>
  );
}
