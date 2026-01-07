import { useState } from "react";
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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useEmailRules,
  useCreateEmailRule,
  useUpdateEmailRule,
  useDeleteEmailRule,
  useReorderEmailRules,
  EmailRule,
  RuleCondition,
  RuleAction,
  ConditionField,
  ConditionOperator,
} from "@/hooks/useEmailRules";
import {
  GripVertical,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Loader2,
  Filter,
  Zap,
} from "lucide-react";
import { format } from "date-fns";

const actionLabels: Record<RuleAction, string> = {
  classify: "Auto-classify",
  spam: "Mark as Spam",
  ignore: "Ignore",
  auto_reply: "Auto Reply",
};

const actionColors: Record<RuleAction, string> = {
  classify: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  spam: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ignore: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
  auto_reply: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const fieldLabels: Record<ConditionField, string> = {
  subject: "Subject",
  body: "Body",
  from: "From",
};

const operatorLabels: Record<ConditionOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  starts_with: "starts with",
  ends_with: "ends with",
};

function SortableRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: EmailRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const conditionSummary = rule.conditions
    .map(
      (c) => `${fieldLabels[c.field]} ${operatorLabels[c.operator]} "${c.value}"`
    )
    .join(" AND ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-4 bg-card ${
        !rule.is_active ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-1 cursor-grab touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{rule.name}</span>
            <Badge className={actionColors[rule.action]}>
              {actionLabels[rule.action]}
            </Badge>
            {rule.created_from_correction && (
              <Badge variant="outline" className="text-xs">
                From correction
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {conditionSummary || "No conditions"}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Matched {rule.times_matched} times</span>
            {rule.last_matched_at && (
              <span>
                Last: {format(new Date(rule.last_matched_at), "MMM d, h:mm a")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={rule.is_active}
            onCheckedChange={onToggle}
            aria-label="Toggle rule"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface RuleEditorProps {
  rule?: EmailRule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RuleEditor({ rule, open, onOpenChange }: RuleEditorProps) {
  const createRule = useCreateEmailRule();
  const updateRule = useUpdateEmailRule();

  const [name, setName] = useState(rule?.name || "");
  const [action, setAction] = useState<RuleAction>(rule?.action || "classify");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions || [{ field: "subject", operator: "contains", value: "" }]
  );

  const handleSave = () => {
    if (rule) {
      updateRule.mutate(
        { ruleId: rule.id, updates: { name, action, conditions } },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createRule.mutate(
        { name, action, conditions },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: "subject", operator: "contains", value: "" },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (
    index: number,
    updates: Partial<RuleCondition>
  ) => {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Rule" : "Create Rule"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <Label htmlFor="rule_name">Rule Name</Label>
            <Input
              id="rule_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mark newsletters as spam"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCondition}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {conditions.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(v) =>
                    updateCondition(index, { field: v as ConditionField })
                  }
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="body">Body</SelectItem>
                    <SelectItem value="from">From</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={condition.operator}
                  onValueChange={(v) =>
                    updateCondition(index, { operator: v as ConditionOperator })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="not_contains">doesn't contain</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="starts_with">starts with</SelectItem>
                    <SelectItem value="ends_with">ends with</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(index, { value: e.target.value })
                  }
                  placeholder="Value"
                  className="flex-1"
                />

                {conditions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCondition(index)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div>
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as RuleAction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classify">Auto-classify as Service Request</SelectItem>
                <SelectItem value="spam">Mark as Spam</SelectItem>
                <SelectItem value="ignore">Ignore</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rule ? "Save Changes" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmailRulesManager() {
  const { data: rules, isLoading } = useEmailRules();
  const updateRule = useUpdateEmailRule();
  const deleteRule = useDeleteEmailRule();
  const reorderRules = useReorderEmailRules();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && rules) {
      const oldIndex = rules.findIndex((r) => r.id === active.id);
      const newIndex = rules.findIndex((r) => r.id === over.id);

      // Create new order
      const newOrder = [...rules];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);

      reorderRules.mutate(newOrder.map((r) => r.id));
    }
  };

  const handleEdit = (rule: EmailRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingRule(undefined);
    setEditorOpen(true);
  };

  const handleToggle = (rule: EmailRule, active: boolean) => {
    updateRule.mutate({ ruleId: rule.id, updates: { is_active: active } });
  };

  const handleDelete = (ruleId: string) => {
    deleteRule.mutate(ruleId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Email Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Email Rules
          </CardTitle>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {!rules || rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No email rules configured yet.</p>
              <p className="text-sm">
                Create rules to automatically classify or filter incoming emails.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rules.map((r) => r.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <SortableRuleCard
                      key={rule.id}
                      rule={rule}
                      onEdit={() => handleEdit(rule)}
                      onDelete={() => handleDelete(rule.id)}
                      onToggle={(active) => handleToggle(rule, active)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <RuleEditor
        rule={editingRule}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </>
  );
}
