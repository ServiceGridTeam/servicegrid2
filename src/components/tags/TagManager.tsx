import { useState } from 'react';
import { GripVertical, MoreVertical, Pencil, Plus, Trash2, AlertCircle, Info, Lock } from 'lucide-react';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, useReorderTags, useTagCreationRateLimit, type MediaTag, type TagColor } from '@/hooks/useTags';
import { TagChip } from './TagChip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const colorOptions: { value: TagColor; label: string; class: string }[] = [
  { value: 'red', label: 'Red', class: 'bg-red-400' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-400' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-400' },
  { value: 'green', label: 'Green', class: 'bg-green-400' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-400' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-400' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-400' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-400' },
];

interface SortableTagRowProps {
  tag: MediaTag;
  onEdit: (tag: MediaTag) => void;
  onDelete: (tag: MediaTag) => void;
}

function SortableTagRow({ tag, onEdit, onDelete }: SortableTagRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tag.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 bg-card rounded-lg border',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <TagChip name={tag.name} color={tag.color} size="md" />

      {tag.is_system && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs cursor-help gap-1">
              <Lock className="h-3 w-3" />
              System
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px]">
            <p className="text-xs">
              System tags are built-in and cannot be renamed or deleted. 
              You can still change the color and group.
            </p>
          </TooltipContent>
        </Tooltip>
      )}

      <span className="text-sm text-muted-foreground ml-auto">
        {tag.usage_count} uses
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(tag)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          {tag.is_system ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Lock className="h-4 w-4 mr-2" />
              Delete
              <Badge variant="outline" className="ml-2 text-xs">Protected</Badge>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={() => onDelete(tag)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface TagFormData {
  name: string;
  color: TagColor;
  description: string;
  tag_group: string;
}

export function TagManager() {
  const { data: tags = [], isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const reorderTags = useReorderTags();
  const rateLimit = useTagCreationRateLimit();

  const [editingTag, setEditingTag] = useState<MediaTag | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<MediaTag | null>(null);
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: 'blue',
    description: '',
    tag_group: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tags.findIndex(t => t.id === active.id);
    const newIndex = tags.findIndex(t => t.id === over.id);
    const newOrder = arrayMove(tags, oldIndex, newIndex);

    reorderTags.mutate(newOrder.map(t => t.id));
  };

  const openCreate = () => {
    setFormData({ name: '', color: 'blue', description: '', tag_group: '' });
    setIsCreateOpen(true);
  };

  const openEdit = (tag: MediaTag) => {
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || '',
      tag_group: tag.tag_group || '',
    });
    setEditingTag(tag);
  };

  const handleSave = async () => {
    if (editingTag) {
      await updateTag.mutateAsync({
        tagId: editingTag.id,
        updates: {
          name: editingTag.is_system ? undefined : formData.name, // Don't update name for system tags
          color: formData.color,
          description: formData.description || undefined,
          tag_group: formData.tag_group || undefined,
        },
      });
      setEditingTag(null);
    } else {
      await createTag.mutateAsync({
        name: formData.name,
        color: formData.color,
        description: formData.description || undefined,
        tag_group: formData.tag_group || undefined,
      });
      setIsCreateOpen(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteTag.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  // Group tags by tag_group
  const groupedTags = tags.reduce((acc, tag) => {
    const group = tag.tag_group || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(tag);
    return acc;
  }, {} as Record<string, MediaTag[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Photo Tags</CardTitle>
            <CardDescription>
              Create and manage tags to organize your job photos
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {rateLimit.isNearLimit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {rateLimit.remaining}/20 remaining
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Tag creation limit resets in {rateLimit.resetTimeMinutes} min</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Button 
              onClick={openCreate} 
              className="gap-2"
              disabled={!rateLimit.canCreate}
            >
              <Plus className="h-4 w-4" />
              New Tag
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tags.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                {Object.entries(groupedTags).map(([group, groupTags]) => (
                  <div key={group}>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                      {group}
                    </h4>
                    <div className="space-y-2">
                      {groupTags.map(tag => (
                        <SortableTagRow
                          key={tag.id}
                          tag={tag}
                          onEdit={openEdit}
                          onDelete={setDeleteConfirm}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {tags.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No tags yet. Create your first tag to get started.</p>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingTag} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingTag(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            <DialogDescription>
              {editingTag 
                ? 'Update the tag details below' 
                : 'Create a new tag to organize your photos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* System tag warning */}
            {editingTag?.is_system && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  System tag names are protected. You can change the color and group.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Completed Work"
                disabled={editingTag?.is_system}
              />
              {editingTag?.is_system && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  System tag names cannot be changed
                </p>
              )}
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {colorOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, color: option.value }))}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-transform',
                      option.class,
                      formData.color === option.value
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    title={option.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="group">Group (optional)</Label>
              <Input
                id="group"
                value={formData.tag_group}
                onChange={e => setFormData(f => ({ ...f, tag_group: e.target.value }))}
                placeholder="e.g., Documentation, Issues"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this tag used for?"
                rows={2}
              />
            </div>

            <div>
              <Label>Preview</Label>
              <div className="mt-2">
                <TagChip 
                  name={formData.name || 'Tag Name'} 
                  color={formData.color} 
                  size="lg" 
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingTag(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || createTag.isPending || updateTag.isPending}
            >
              {editingTag ? 'Save Changes' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              Delete Tag
              {deleteConfirm?.is_system && (
                <Badge variant="destructive">System Tag</Badge>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.is_system ? (
                <>
                  <span className="font-medium text-destructive">This is a system tag and cannot be deleted.</span>
                  <br />
                  System tags are built-in to ensure consistent organization.
                </>
              ) : (
                <>
                  Are you sure you want to delete "{deleteConfirm?.name}"? 
                  This tag will be removed from all photos.
                  <span className="block mt-2 font-medium">This action cannot be undone.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleteConfirm?.is_system && (
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
