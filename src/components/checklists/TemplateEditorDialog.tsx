import { useState, useEffect } from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TemplateItemRow, TemplateItemData } from "./TemplateItemRow";
import { ChecklistTemplate } from "@/hooks/useChecklistTemplates";

interface TemplateEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ChecklistTemplate | null;
  onSave: (data: {
    name: string;
    description: string;
    jobType: string | null;
    isActive: boolean;
    autoApply: boolean;
    requireAllPhotos: boolean;
    allowNotes: boolean;
    items: TemplateItemData[];
  }) => void;
  isSaving?: boolean;
}

export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSave,
  isSaving,
}: TemplateEditorDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [requireAllPhotos, setRequireAllPhotos] = useState(false);
  const [allowNotes, setAllowNotes] = useState(true);
  const [items, setItems] = useState<TemplateItemData[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setJobType(template.jobType || "");
      setIsActive(template.isActive);
      setAutoApply(template.autoApply);
      setRequireAllPhotos(template.requireAllPhotos);
      setAllowNotes(template.allowNotes);
      setItems(template.items.map(item => ({
        id: item.id,
        order: item.order,
        label: item.label,
        description: item.description,
        photoRequired: item.photoRequired,
        minPhotos: item.minPhotos,
        maxPhotos: item.maxPhotos,
        category: item.category,
      })));
    } else {
      setName("");
      setDescription("");
      setJobType("");
      setIsActive(true);
      setAutoApply(false);
      setRequireAllPhotos(false);
      setAllowNotes(true);
      setItems([]);
    }
  }, [template, open]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return newItems.map((item, index) => ({ ...item, order: index }));
      });
    }
  };

  const addItem = () => {
    const newItem: TemplateItemData = {
      id: crypto.randomUUID(),
      order: items.length,
      label: "",
      description: "",
      photoRequired: false,
      minPhotos: 0,
      maxPhotos: 5,
      category: undefined,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, updates: Partial<TemplateItemData>) => {
    setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id).map((item, index) => ({ ...item, order: index })));
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      jobType: jobType || null,
      isActive,
      autoApply,
      requireAllPhotos,
      allowNotes,
      items,
    });
  };

  const isValid = name.trim().length > 0 && items.every((item) => item.label.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {template
              ? "Update the checklist template details and items."
              : "Create a new checklist template for quality assurance."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Pre-Service Inspection"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when this checklist should be used..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type (for auto-apply)</Label>
                <Input
                  id="jobType"
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value)}
                  placeholder="e.g., HVAC Maintenance, Lawn Care"
                />
                <p className="text-xs text-muted-foreground">
                  If set and auto-apply is enabled, this template will automatically attach to matching jobs.
                </p>
              </div>
            </div>

            <Separator />

            {/* Settings Toggles */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="isActive" className="text-sm">Active</Label>
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="autoApply" className="text-sm">Auto-Apply</Label>
                  <Switch id="autoApply" checked={autoApply} onCheckedChange={setAutoApply} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="requireAllPhotos" className="text-sm">Require All Photos</Label>
                  <Switch id="requireAllPhotos" checked={requireAllPhotos} onCheckedChange={setRequireAllPhotos} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="allowNotes" className="text-sm">Allow Notes</Label>
                  <Switch id="allowNotes" checked={allowNotes} onCheckedChange={setAllowNotes} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Checklist Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Checklist Items</h4>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <p>No items yet. Click "Add Item" to get started.</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <AnimatePresence mode="popLayout">
                      <div className="space-y-2">
                        {items.map((item, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03, duration: 0.2 }}
                          >
                            <TemplateItemRow
                              item={item}
                              onUpdate={updateItem}
                              onDelete={deleteItem}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </AnimatePresence>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? "Saving..." : template ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
