import { useState } from 'react';
import { Loader2, Tag as TagIcon, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TagPicker } from './TagPicker';
import { TagChip } from './TagChip';
import { useTags, useCreateTag, type TagColor } from '@/hooks/useTags';
import { useBulkTagPhotos, useBulkUntagPhotos } from '@/hooks/usePhotoTags';

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMediaIds: string[];
  thumbnails?: { id: string; url: string }[];
  onComplete?: () => void;
}

export function BulkTagDialog({
  open,
  onOpenChange,
  selectedMediaIds,
  thumbnails = [],
  onComplete,
}: BulkTagDialogProps) {
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  const { data: allTags = [] } = useTags();
  const createTag = useCreateTag();
  const bulkTag = useBulkTagPhotos();
  const bulkUntag = useBulkUntagPhotos();

  const handleAddTag = (tagId: string) => {
    if (!tagsToAdd.includes(tagId)) {
      setTagsToAdd([...tagsToAdd, tagId]);
    }
    // Remove from "to remove" if present
    setTagsToRemove(tagsToRemove.filter(id => id !== tagId));
  };

  const handleRemoveFromAdd = (tagId: string) => {
    setTagsToAdd(tagsToAdd.filter(id => id !== tagId));
  };

  const handleMarkForRemoval = (tagId: string) => {
    if (!tagsToRemove.includes(tagId)) {
      setTagsToRemove([...tagsToRemove, tagId]);
    }
    // Remove from "to add" if present
    setTagsToAdd(tagsToAdd.filter(id => id !== tagId));
  };

  const handleRemoveFromRemoval = (tagId: string) => {
    setTagsToRemove(tagsToRemove.filter(id => id !== tagId));
  };

  const handleCreateTag = async (name: string, color: TagColor) => {
    const newTag = await createTag.mutateAsync({ name, color });
    if (newTag) {
      setTagsToAdd([...tagsToAdd, newTag.id]);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    setProgress(0);

    try {
      const totalOperations = (tagsToAdd.length > 0 ? 1 : 0) + (tagsToRemove.length > 0 ? 1 : 0);
      let completed = 0;

      // Add tags
      if (tagsToAdd.length > 0) {
        await bulkTag.mutateAsync({
          mediaIds: selectedMediaIds,
          tagIds: tagsToAdd,
          onProgress: (done, total) => {
            const baseProgress = (completed / totalOperations) * 100;
            const currentProgress = (done / total) * (100 / totalOperations);
            setProgress(baseProgress + currentProgress);
          },
        });
        completed++;
        setProgress((completed / totalOperations) * 100);
      }

      // Remove tags
      if (tagsToRemove.length > 0) {
        await bulkUntag.mutateAsync({
          mediaIds: selectedMediaIds,
          tagIds: tagsToRemove,
        });
        completed++;
        setProgress(100);
      }

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

      // Close dialog and reset
      setTimeout(() => {
        onOpenChange(false);
        setTagsToAdd([]);
        setTagsToRemove([]);
        setProgress(0);
        setIsApplying(false);
        onComplete?.();
      }, 500);
    } catch (error) {
      console.error('Bulk tag failed:', error);
      setIsApplying(false);
    }
  };

  const tagsToAddDetails = allTags.filter(t => tagsToAdd.includes(t.id));
  const tagsToRemoveDetails = allTags.filter(t => tagsToRemove.includes(t.id));
  const hasChanges = tagsToAdd.length > 0 || tagsToRemove.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !isApplying && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Tag {selectedMediaIds.length} Photos
          </DialogTitle>
          <DialogDescription>
            Add or remove tags from the selected photos
          </DialogDescription>
        </DialogHeader>

        {/* Thumbnails preview */}
        {thumbnails.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {thumbnails.slice(0, 12).map(t => (
              <div
                key={t.id}
                className="w-12 h-12 rounded overflow-hidden bg-muted"
              >
                <img
                  src={t.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {thumbnails.length > 12 && (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{thumbnails.length - 12}
              </div>
            )}
          </div>
        )}

        {/* Tags to add */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tags to add</label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/50">
            {tagsToAddDetails.map(tag => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                size="sm"
                removable
                onRemove={() => handleRemoveFromAdd(tag.id)}
              />
            ))}
            <TagPicker
              selectedTagIds={tagsToAdd}
              onTagSelect={handleAddTag}
              onTagRemove={handleRemoveFromAdd}
              onCreateTag={handleCreateTag}
              variant="inline"
              showSelectedInline={false}
              placeholder="Add tags..."
            />
          </div>
        </div>

        {/* Tags to remove */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Tags to remove (optional)
          </label>
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md border-dashed">
            {tagsToRemoveDetails.map(tag => (
              <TagChip
                key={tag.id}
                name={tag.name}
                color={tag.color}
                size="sm"
                removable
                onRemove={() => handleRemoveFromRemoval(tag.id)}
                className="opacity-60 line-through"
              />
            ))}
            <TagPicker
              selectedTagIds={tagsToRemove}
              onTagSelect={handleMarkForRemoval}
              onTagRemove={handleRemoveFromRemoval}
              variant="inline"
              showSelectedInline={false}
              placeholder="Remove tags..."
            />
          </div>
        </div>

        {/* Progress bar */}
        {isApplying && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {progress < 100 ? 'Applying tags...' : 'Complete!'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Applying...
              </>
            ) : (
              `Apply to ${selectedMediaIds.length} photos`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}