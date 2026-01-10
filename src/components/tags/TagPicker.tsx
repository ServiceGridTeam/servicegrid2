import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Plus, Search, Tag as TagIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTags, type MediaTag, type TagColor } from '@/hooks/useTags';
import { MAX_TAGS_PER_PHOTO } from '@/lib/tagValidation';
import { TagChip } from './TagChip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TagPickerProps {
  selectedTagIds: string[];
  onTagSelect: (tagId: string) => void;
  onTagRemove: (tagId: string) => void;
  onCreateTag?: (name: string, color: TagColor) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  variant?: 'button' | 'inline';
  showSelectedInline?: boolean;
  className?: string;
  /** Current number of tags on this photo (for limit enforcement) */
  currentTagCount?: number;
}

const quickColors: TagColor[] = ['blue', 'green', 'yellow', 'red', 'purple', 'gray'];

export function TagPicker({
  selectedTagIds,
  onTagSelect,
  onTagRemove,
  onCreateTag,
  disabled = false,
  placeholder = 'Add tags...',
  variant = 'button',
  showSelectedInline = true,
  className,
  currentTagCount = 0,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagColor, setNewTagColor] = useState<TagColor>('blue');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allTags = [], isLoading } = useTags();

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!search) return allTags;
    const lower = search.toLowerCase();
    return allTags.filter(t => 
      t.name.toLowerCase().includes(lower) ||
      t.tag_group?.toLowerCase().includes(lower)
    );
  }, [allTags, search]);

  // Group tags by tag_group
  const groupedTags = useMemo(() => {
    const groups: Record<string, MediaTag[]> = {};
    filteredTags.forEach(tag => {
      const group = tag.tag_group || 'Other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(tag);
    });
    return groups;
  }, [filteredTags]);

  const flatTags = filteredTags;
  const canCreate = search.trim() && !allTags.some(t => t.name.toLowerCase() === search.toLowerCase());
  
  // Calculate tag limit status
  const effectiveTagCount = currentTagCount + selectedTagIds.length;
  const isAtTagLimit = effectiveTagCount >= MAX_TAGS_PER_PHOTO;
  const isNearTagLimit = effectiveTagCount >= MAX_TAGS_PER_PHOTO - 5;

  // Reset focus when search changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [search]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch('');
      setIsCreating(false);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, flatTags.length - 1 + (canCreate ? 1 : 0)));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (canCreate && focusedIndex === flatTags.length) {
          handleCreate();
        } else if (flatTags[focusedIndex]) {
          handleToggle(flatTags[focusedIndex].id);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
    }
  };

  const handleToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagRemove(tagId);
    } else {
      // Prevent adding if at limit
      if (isAtTagLimit) {
        return;
      }
      onTagSelect(tagId);
    }
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleCreate = async () => {
    if (!onCreateTag || !search.trim()) return;
    setIsCreating(true);
    try {
      await onCreateTag(search.trim(), newTagColor);
      setSearch('');
    } finally {
      setIsCreating(false);
    }
  };

  const selectedTags = allTags.filter(t => selectedTagIds.includes(t.id));

  const trigger = variant === 'button' ? (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn('gap-1.5', className)}
    >
      <TagIcon className="h-3.5 w-3.5" />
      {selectedTagIds.length > 0 ? `${selectedTagIds.length} tags` : placeholder}
    </Button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex flex-wrap gap-1.5 items-center p-1.5 rounded-md border border-dashed',
        'border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors',
        'min-h-[36px] cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {showSelectedInline && selectedTags.length > 0 ? (
        <>
          {selectedTags.slice(0, 5).map(tag => (
            <TagChip
              key={tag.id}
              name={tag.name}
              color={tag.color}
              size="sm"
              removable
              onRemove={() => onTagRemove(tag.id)}
            />
          ))}
          {selectedTags.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{selectedTags.length - 5} more
            </span>
          )}
        </>
      ) : (
        <span className="text-sm text-muted-foreground flex items-center gap-1.5 px-1">
          <Plus className="h-3.5 w-3.5" />
          {placeholder}
        </span>
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search or create tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-8 h-8"
            />
          </div>
          {/* Tag limit indicator */}
          {isNearTagLimit && (
            <div className={cn(
              "flex items-center gap-1.5 mt-2 text-xs",
              isAtTagLimit ? "text-destructive" : "text-amber-600"
            )}>
              <AlertCircle className="h-3 w-3" />
              {isAtTagLimit 
                ? `Tag limit reached (${MAX_TAGS_PER_PHOTO} max)`
                : `${MAX_TAGS_PER_PHOTO - effectiveTagCount} tags remaining`
              }
            </div>
          )}
        </div>

        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading tags...
            </div>
          ) : (
            <div className="p-1">
              {Object.entries(groupedTags).map(([group, tags]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {group}
                  </div>
                  {tags.map((tag, i) => {
                    const globalIndex = flatTags.indexOf(tag);
                    const isSelected = selectedTagIds.includes(tag.id);
                    const isFocused = focusedIndex === globalIndex;

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggle(tag.id)}
                        disabled={isAtTagLimit && !isSelected}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
                          'hover:bg-accent transition-colors',
                          isFocused && 'bg-accent',
                          isSelected && 'bg-primary/10',
                          isAtTagLimit && !isSelected && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <TagChip name={tag.name} color={tag.color} size="sm" />
                        {tag.usage_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {tag.usage_count}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-primary ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              {filteredTags.length === 0 && !canCreate && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No tags found
                </div>
              )}

              {canCreate && onCreateTag && !isAtTagLimit && (
                <div className="border-t mt-1 pt-1">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left',
                      'hover:bg-accent transition-colors',
                      focusedIndex === flatTags.length && 'bg-accent'
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm">Create "{search}"</span>
                    <div className="flex gap-1 ml-auto">
                      {quickColors.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setNewTagColor(c);
                          }}
                          className={cn(
                            'w-4 h-4 rounded-full border-2 transition-transform',
                            c === 'red' && 'bg-red-400',
                            c === 'orange' && 'bg-orange-400',
                            c === 'yellow' && 'bg-yellow-400',
                            c === 'green' && 'bg-green-400',
                            c === 'blue' && 'bg-blue-400',
                            c === 'purple' && 'bg-purple-400',
                            c === 'gray' && 'bg-gray-400',
                            newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'
                          )}
                        />
                      ))}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
