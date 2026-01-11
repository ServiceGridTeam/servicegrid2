import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Package, MoreVertical, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import {
  useServicePlans,
  useCreateServicePlan,
  useUpdateServicePlan,
  useDeleteServicePlan,
  type ServicePlan,
} from "@/hooks/useServicePlans";

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Semi-annual",
  annual: "Annual",
};

const BILLING_MODEL_LABELS: Record<string, string> = {
  prepay: "Prepay",
  per_visit: "Per Visit",
  hybrid: "Hybrid",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function ServicePlanSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      ))}
    </div>
  );
}

interface CreatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: ServicePlan;
}

function CreatePlanDialog({ open, onOpenChange, editPlan }: CreatePlanDialogProps) {
  const createPlan = useCreateServicePlan();
  const updatePlan = useUpdateServicePlan();
  const isEditing = !!editPlan;

  const [formData, setFormData] = useState({
    name: editPlan?.name || "",
    description: editPlan?.description || "",
    code: editPlan?.code || "",
    base_price: editPlan?.base_price?.toString() || "",
    default_frequency: editPlan?.default_frequency || "monthly",
    billing_model: editPlan?.billing_model || "prepay",
    estimated_duration_minutes: editPlan?.estimated_duration_minutes?.toString() || "",
    is_taxable: editPlan?.is_taxable ?? true,
    available_in_portal: editPlan?.available_in_portal ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const input = {
      name: formData.name,
      description: formData.description || undefined,
      code: formData.code || undefined,
      base_price: parseFloat(formData.base_price) || 0,
      default_frequency: formData.default_frequency as any,
      billing_model: formData.billing_model as any,
      estimated_duration_minutes: formData.estimated_duration_minutes 
        ? parseInt(formData.estimated_duration_minutes) 
        : undefined,
      is_taxable: formData.is_taxable,
      available_in_portal: formData.available_in_portal,
    };

    if (isEditing) {
      await updatePlan.mutateAsync({ id: editPlan.id, ...input });
    } else {
      await createPlan.mutateAsync(input);
    }
    
    onOpenChange(false);
    // Reset form
    setFormData({
      name: "",
      description: "",
      code: "",
      base_price: "",
      default_frequency: "monthly",
      billing_model: "prepay",
      estimated_duration_minutes: "",
      is_taxable: true,
      available_in_portal: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Service Plan" : "Create Service Plan"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update this service plan template." 
                : "Create a reusable template for recurring services."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekly Lawn Care"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Plan Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., LAWN-WK"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="base_price">Base Price *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Frequency</Label>
                <Select
                  value={formData.default_frequency}
                  onValueChange={(value) => setFormData({ ...formData, default_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Billing Model</Label>
                <Select
                  value={formData.billing_model}
                  onValueChange={(value) => setFormData({ ...formData, billing_model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_MODEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this plan includes..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="duration">Estimated Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="0"
                value={formData.estimated_duration_minutes}
                onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: e.target.value })}
                placeholder="60"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Taxable</Label>
                <p className="text-sm text-muted-foreground">Apply tax to this service</p>
              </div>
              <Switch
                checked={formData.is_taxable}
                onCheckedChange={(checked) => setFormData({ ...formData, is_taxable: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show in Portal</Label>
                <p className="text-sm text-muted-foreground">Customers can see this plan</p>
              </div>
              <Switch
                checked={formData.available_in_portal}
                onCheckedChange={(checked) => setFormData({ ...formData, available_in_portal: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createPlan.isPending || updatePlan.isPending}
            >
              {createPlan.isPending || updatePlan.isPending 
                ? "Saving..." 
                : isEditing ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ServicePlanRow({ plan }: { plan: ServicePlan }) {
  const updatePlan = useUpdateServicePlan();
  const deletePlan = useDeleteServicePlan();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{plan.name}</span>
            {plan.code && (
              <span className="text-xs text-muted-foreground">({plan.code})</span>
            )}
            {!plan.is_active && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(plan.base_price)} • {FREQUENCY_LABELS[plan.default_frequency]} • {BILLING_MODEL_LABELS[plan.billing_model]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {plan.available_in_portal ? (
            <Badge variant="default" className="gap-1">
              <Eye className="h-3 w-3" />
              Portal
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <EyeOff className="h-3 w-3" />
              Hidden
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updatePlan.mutate({ id: plan.id, is_active: !plan.is_active })}
              >
                {plan.is_active ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setIsDeleteOpen(true)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CreatePlanDialog open={isEditing} onOpenChange={setIsEditing} editPlan={plan} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{plan.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePlan.mutate(plan.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ServicePlanManager() {
  const { data: plans, isLoading, error } = useServicePlans(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Plans</CardTitle>
          <CardDescription>Reusable templates for recurring services</CardDescription>
        </CardHeader>
        <CardContent>
          <ServicePlanSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">Failed to load service plans</p>
        </CardContent>
      </Card>
    );
  }

  if (!plans?.length) {
    return (
      <Card>
        <CardHeader className="text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <CardTitle>No service plans yet</CardTitle>
          <CardDescription>
            Create your first service plan to start offering subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </CardContent>
        <CreatePlanDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Service Plans</CardTitle>
          <CardDescription>Reusable templates for recurring services</CardDescription>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <ServicePlanRow plan={plan} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
      <CreatePlanDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </Card>
  );
}
