import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TemplateItemData {
  id: string;
  order: number;
  label: string;
  description?: string;
  photoRequired: boolean;
  minPhotos: number;
  maxPhotos: number;
  category?: string;
}

interface TemplateItemRowProps {
  item: TemplateItemData;
  onUpdate: (id: string, updates: Partial<TemplateItemData>) => void;
  onDelete: (id: string) => void;
}

export function TemplateItemRow({ item, onUpdate, onDelete }: TemplateItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Main Content */}
      <div className="flex-1 space-y-3">
        {/* Label */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Item Label</Label>
          <Input
            value={item.label}
            onChange={(e) => onUpdate(item.id, { label: e.target.value })}
            placeholder="e.g., Check tire pressure"
            className="h-9"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description (optional)</Label>
          <Input
            value={item.description || ""}
            onChange={(e) => onUpdate(item.id, { description: e.target.value })}
            placeholder="Additional instructions..."
            className="h-9"
          />
        </div>

        {/* Photo Requirement */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={item.photoRequired}
              onCheckedChange={(checked) =>
                onUpdate(item.id, { 
                  photoRequired: checked,
                  minPhotos: checked ? Math.max(1, item.minPhotos) : 0
                })
              }
            />
            <Label className="text-sm flex items-center gap-1.5">
              <Camera className="h-4 w-4" />
              Require Photo
            </Label>
          </div>

          {item.photoRequired && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Min:</Label>
                <Input
                  type="number"
                  min={1}
                  max={item.maxPhotos}
                  value={item.minPhotos}
                  onChange={(e) => onUpdate(item.id, { minPhotos: parseInt(e.target.value) || 1 })}
                  className="h-8 w-16"
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Max:</Label>
                <Input
                  type="number"
                  min={item.minPhotos}
                  max={10}
                  value={item.maxPhotos}
                  onChange={(e) => onUpdate(item.id, { maxPhotos: parseInt(e.target.value) || 5 })}
                  className="h-8 w-16"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(item.id)}
        className="mt-1 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
