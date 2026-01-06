import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBreakRules, useCreateBreakRule, useUpdateBreakRule, useDeleteBreakRule, BreakRule } from "@/hooks/useBreakRules";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Coffee, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BreakRuleFormData {
  name: string;
  triggerHours: number;
  deductionMinutes: number;
  isPaid: boolean;
  isAutomatic: boolean;
}

const defaultFormData: BreakRuleFormData = {
  name: "",
  triggerHours: 6,
  deductionMinutes: 30,
  isPaid: false,
  isAutomatic: true,
};

export function BreakRulesSettings() {
  const { toast } = useToast();
  const { data: breakRules, isLoading } = useBreakRules();
  const createRule = useCreateBreakRule();
  const updateRule = useUpdateBreakRule();
  const deleteRule = useDeleteBreakRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BreakRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<BreakRule | null>(null);
  const [formData, setFormData] = useState<BreakRuleFormData>(defaultFormData);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (rule: BreakRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      triggerHours: rule.trigger_hours,
      deductionMinutes: rule.deduction_minutes,
      isPaid: rule.is_paid ?? false,
      isAutomatic: rule.is_automatic ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          id: editingRule.id,
          name: formData.name,
          triggerHours: formData.triggerHours,
          deductionMinutes: formData.deductionMinutes,
          isPaid: formData.isPaid,
          isAutomatic: formData.isAutomatic,
        });
        toast({ title: "Break rule updated" });
      } else {
        await createRule.mutateAsync({
          name: formData.name,
          triggerHours: formData.triggerHours,
          deductionMinutes: formData.deductionMinutes,
          isPaid: formData.isPaid,
          isAutomatic: formData.isAutomatic,
        });
        toast({ title: "Break rule created" });
      }
      setDialogOpen(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save break rule",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (rule: BreakRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        isActive: !rule.is_active,
      });
      toast({
        title: rule.is_active ? "Rule deactivated" : "Rule activated",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to update rule",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!ruleToDelete) return;
    
    try {
      await deleteRule.mutateAsync(ruleToDelete.id);
      toast({ title: "Break rule deleted" });
      setDeleteDialogOpen(false);
      setRuleToDelete(null);
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete break rule",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (rule: BreakRule) => {
    setRuleToDelete(rule);
    setDeleteDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Break Rules</CardTitle>
              <CardDescription>
                Configure automatic break deductions for shifts
              </CardDescription>
            </div>
          </div>
          <Button onClick={handleOpenCreate} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !breakRules?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            <Coffee className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No break rules configured</p>
            <p className="text-sm">Add a rule to auto-deduct breaks from shifts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Trigger After</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{rule.trigger_hours} hours</TableCell>
                  <TableCell>{rule.deduction_minutes} min</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant={rule.is_paid ? "default" : "secondary"}>
                        {rule.is_paid ? "Paid" : "Unpaid"}
                      </Badge>
                      {rule.is_automatic && (
                        <Badge variant="outline">Auto</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active ?? true}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(rule)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Automatic rules apply break deductions to shifts that exceed the trigger threshold.
          Paid breaks are included in labor cost calculations.
        </p>
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Break Rule" : "Add Break Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the break rule settings"
                : "Create a new automatic break deduction rule"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Lunch Break"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="triggerHours">Trigger After (hours)</Label>
                <Input
                  id="triggerHours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.triggerHours}
                  onChange={(e) =>
                    setFormData({ ...formData, triggerHours: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deductionMinutes">Deduction (minutes)</Label>
                <Input
                  id="deductionMinutes"
                  type="number"
                  min="1"
                  value={formData.deductionMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, deductionMinutes: parseInt(e.target.value) || 0 })
                  }
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label htmlFor="isPaid">Paid Break</Label>
                <p className="text-xs text-muted-foreground">
                  Include in labor cost calculations
                </p>
              </div>
              <Switch
                id="isPaid"
                checked={formData.isPaid}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPaid: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <Label htmlFor="isAutomatic">Automatic Deduction</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-apply when shift exceeds threshold
                </p>
              </div>
              <Switch
                id="isAutomatic"
                checked={formData.isAutomatic}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isAutomatic: checked })
                }
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRule.isPending || updateRule.isPending}>
                {(createRule.isPending || updateRule.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingRule ? "Save Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Break Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ruleToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRule.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
