import { useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateLineTotal } from "@/hooks/useInvoiceCalculations";
import { cn } from "@/lib/utils";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface InvoiceLineItemsEditorProps {
  items: InvoiceLineItem[];
  onItemsChange: (items: InvoiceLineItem[]) => void;
}

interface SortableItemProps {
  item: InvoiceLineItem;
  onUpdate: (id: string, field: keyof InvoiceLineItem, value: string | number) => void;
  onDelete: (id: string) => void;
  isOnly: boolean;
}

function SortableItem({ item, onUpdate, onDelete, isOnly }: SortableItemProps) {
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

  const lineTotal = calculateLineTotal(item.quantity, item.unit_price);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-3 bg-background border rounded-lg",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 grid grid-cols-12 gap-2 items-center">
        <div className="col-span-5">
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(e) => onUpdate(item.id, "description", e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Qty"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, "quantity", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="col-span-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={item.unit_price}
            onChange={(e) => onUpdate(item.id, "unit_price", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="col-span-2 text-right font-medium">
          ${lineTotal.toFixed(2)}
        </div>
        <div className="col-span-1 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onDelete(item.id)}
            disabled={isOnly}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InvoiceLineItemsEditor({ items, onItemsChange }: InvoiceLineItemsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleUpdate = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    onItemsChange(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleDelete = (id: string) => {
    if (items.length > 1) {
      onItemsChange(items.filter((item) => item.id !== id));
    }
  };

  const handleAdd = () => {
    const newItem: InvoiceLineItem = {
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unit_price: 0,
    };
    onItemsChange([...items, newItem]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
      </div>

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 text-sm font-medium text-muted-foreground">
        <div className="w-5" /> {/* Spacer for drag handle */}
        <div className="flex-1 grid grid-cols-12 gap-2">
          <div className="col-span-5">Description</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-2">Unit Price</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1" />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isOnly={items.length === 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" onClick={handleAdd} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Item
      </Button>
    </div>
  );
}
