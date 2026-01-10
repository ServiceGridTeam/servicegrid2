/**
 * Comparison Builder - Create before/after comparisons from job photos
 */

import { useState, useMemo } from 'react';
import { Check, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useJobMedia, type JobMedia } from '@/hooks/useJobMedia';
import { useCreateComparison } from '@/hooks/useComparisons';
import { BeforeAfterComparison } from './BeforeAfterComparison';
import { ComparisonDisplayMode } from '@/types/annotations';
import { toast } from 'sonner';

interface ComparisonBuilderProps {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ComparisonBuilder({
  jobId,
  open,
  onOpenChange,
  onSuccess,
}: ComparisonBuilderProps) {
  const { media, isLoading } = useJobMedia({ jobId });
  const createComparison = useCreateComparison();
  
  const [beforeMediaId, setBeforeMediaId] = useState<string | null>(null);
  const [afterMediaId, setAfterMediaId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [displayMode, setDisplayMode] = useState<ComparisonDisplayMode>('slider');

  // Filter photos only (not videos)
  const photos = useMemo(() => 
    media?.filter(m => m.media_type === 'photo') || [], 
    [media]
  );

  // Get selected photos
  const beforePhoto = photos.find(p => p.id === beforeMediaId);
  const afterPhoto = photos.find(p => p.id === afterMediaId);

  const canCreate = beforeMediaId && afterMediaId && beforeMediaId !== afterMediaId;

  const handleCreate = async () => {
    if (!canCreate) return;

    try {
      await createComparison.mutateAsync({
        jobId,
        beforeMediaId: beforeMediaId!,
        afterMediaId: afterMediaId!,
        title: title || undefined,
        description: description || undefined,
        displayMode,
      });
      
      toast.success('Comparison created');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setBeforeMediaId(null);
      setAfterMediaId(null);
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error('Failed to create comparison:', error);
      toast.error('Failed to create comparison');
    }
  };

  const PhotoGrid = ({ 
    selectedId, 
    onSelect,
    excludeId,
  }: { 
    selectedId: string | null;
    onSelect: (id: string) => void;
    excludeId?: string | null;
  }) => {
    const filteredPhotos = excludeId 
      ? photos.filter(p => p.id !== excludeId)
      : photos;

    if (isLoading) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      );
    }

    if (filteredPhotos.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ImageIcon className="h-8 w-8 mb-2" />
          <p className="text-sm">No photos available</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {filteredPhotos.map((photo) => (
          <button
            key={photo.id}
            type="button"
            className={cn(
              'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
              selectedId === photo.id 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-transparent hover:border-muted-foreground/30'
            )}
            onClick={() => onSelect(photo.id)}
          >
            <img
              src={photo.thumbnail_url_md || photo.url}
              alt=""
              className="w-full h-full object-cover"
            />
            {selectedId === photo.id && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Before/After Comparison</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4">
          {/* Photo Selection */}
          <div className="space-y-4 overflow-hidden flex flex-col">
            <Tabs defaultValue="before" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full">
                <TabsTrigger value="before" className="flex-1">
                  Before {beforeMediaId && '✓'}
                </TabsTrigger>
                <TabsTrigger value="after" className="flex-1">
                  After {afterMediaId && '✓'}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="before" className="flex-1 mt-2 overflow-hidden">
                <ScrollArea className="h-[300px]">
                  <PhotoGrid
                    selectedId={beforeMediaId}
                    onSelect={setBeforeMediaId}
                    excludeId={afterMediaId}
                  />
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="after" className="flex-1 mt-2 overflow-hidden">
                <ScrollArea className="h-[300px]">
                  <PhotoGrid
                    selectedId={afterMediaId}
                    onSelect={setAfterMediaId}
                    excludeId={beforeMediaId}
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Metadata */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Driveway Restoration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the work completed..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <Label>Preview</Label>
            {beforePhoto && afterPhoto ? (
              <BeforeAfterComparison
                beforeUrl={beforePhoto.url}
                afterUrl={afterPhoto.url}
                displayMode={displayMode}
                onModeChange={setDisplayMode}
              />
            ) : (
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">
                    {!beforeMediaId && !afterMediaId 
                      ? 'Select before and after photos'
                      : !beforeMediaId 
                        ? 'Select a before photo'
                        : 'Select an after photo'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!canCreate || createComparison.isPending}
          >
            {createComparison.isPending ? 'Creating...' : 'Create Comparison'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
