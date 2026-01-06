import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, GripVertical, Trash2, Clock, Mail, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  useEmailSequence,
  useCreateEmailSequence,
  useUpdateEmailSequence,
  useCreateSequenceStep,
  useUpdateSequenceStep,
  useDeleteSequenceStep,
  useReorderSequenceSteps,
  SEQUENCE_TRIGGERS,
  type SequenceStep,
} from "@/hooks/useEmailSequences";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { toast } from "sonner";

interface SortableStepProps {
  step: SequenceStep & { email_templates?: { id: string; name: string; subject: string } };
  onUpdate: (id: string, updates: Partial<SequenceStep>) => void;
  onDelete: (id: string) => void;
  templates: Array<{ id: string; name: string }>;
}

function SortableStep({ step, onUpdate, onDelete, templates }: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <Card className={`border-l-4 ${isDragging ? "border-l-primary" : "border-l-muted"}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <button
              {...attributes}
              {...listeners}
              className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-5 w-5" />
            </button>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="shrink-0">
                  Step {step.step_order + 1}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <Input
                    type="number"
                    min={0}
                    value={step.delay_days}
                    onChange={(e) => onUpdate(step.id, { delay_days: parseInt(e.target.value) || 0 })}
                    className="w-16 h-8"
                  />
                  <span>days after previous</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email Template</Label>
                  <Select
                    value={step.template_id}
                    onValueChange={(value) => onUpdate(step.id, { template_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subject Override (optional)</Label>
                  <Input
                    value={step.subject_override || ""}
                    onChange={(e) => onUpdate(step.id, { subject_override: e.target.value || null })}
                    placeholder={step.email_templates?.subject || "Use template subject"}
                  />
                </div>
              </div>

              {step.email_templates && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Using template: {step.email_templates.name}</span>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(step.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SequenceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const { data: sequence, isLoading: sequenceLoading } = useEmailSequence(isNew ? undefined : id);
  const { data: templates } = useEmailTemplates({ isActive: true });

  const createSequence = useCreateEmailSequence();
  const updateSequence = useUpdateEmailSequence();
  const createStep = useCreateSequenceStep();
  const updateStep = useUpdateSequenceStep();
  const deleteStep = useDeleteSequenceStep();
  const reorderSteps = useReorderSequenceSteps();

  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger_type: "manual",
    is_active: false,
  });

  const [steps, setSteps] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (sequence) {
      setForm({
        name: sequence.name,
        description: sequence.description || "",
        trigger_type: sequence.trigger_type,
        is_active: sequence.status === "active",
      });
      setSteps(sequence.sequence_steps || []);
    }
  }, [sequence]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a sequence name");
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const newSequence = await createSequence.mutateAsync(form);
        navigate(`/marketing/sequences/${newSequence.id}`, { replace: true });
      } else if (id) {
        await updateSequence.mutateAsync({ id, ...form });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = async () => {
    if (!id || isNew) {
      toast.error("Please save the sequence first");
      return;
    }

    if (!templates || templates.length === 0) {
      toast.error("Create an email template first");
      return;
    }

    // Get business_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .single();

    if (!profile?.business_id) {
      toast.error("No business found");
      return;
    }

    await createStep.mutateAsync({
      sequence_id: id,
      template_id: templates[0].id,
      step_order: steps.length,
      delay_days: steps.length === 0 ? 0 : 3,
      business_id: profile.business_id,
    });
  };

  const handleUpdateStep = (stepId: string, updates: Partial<SequenceStep>) => {
    updateStep.mutate({ id: stepId, ...updates });
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteStep = (stepId: string) => {
    if (!id) return;
    deleteStep.mutate({ id: stepId, sequenceId: id });
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSteps((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Update step_order for each step
        const reordered = newOrder.map((item, index) => ({
          ...item,
          step_order: index,
        }));

        // Persist to database
        if (id) {
          reorderSteps.mutate({
            sequenceId: id,
            stepIds: reordered.map((s) => s.id),
          });
        }

        return reordered;
      });
    }
  };

  if (sequenceLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing/sequences")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Sequence" : "Edit Sequence"}
            </h1>
            <p className="text-muted-foreground">
              Configure your automated email sequence
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Sequence Details */}
      <Card>
        <CardHeader>
          <CardTitle>Sequence Details</CardTitle>
          <CardDescription>Basic information about this sequence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Welcome Series"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trigger">Trigger</Label>
              <Select
                value={form.trigger_type}
                onValueChange={(value) => setForm({ ...form, trigger_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEQUENCE_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is the purpose of this sequence?"
              rows={2}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="active"
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
            />
            <Label htmlFor="active">
              {form.is_active ? "Sequence is active" : "Sequence is paused"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      {!isNew && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email Steps</CardTitle>
                <CardDescription>
                  Drag to reorder. Each step sends an email after the specified delay.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleAddStep}>
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No steps yet. Add your first email step.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {steps.map((step) => (
                      <SortableStep
                        key={step.id}
                        step={step}
                        onUpdate={handleUpdateStep}
                        onDelete={handleDeleteStep}
                        templates={templates || []}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
