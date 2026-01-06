import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Mail, Play, Pause, Trash2, MoreHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { 
  useEmailSequences, 
  useDeleteEmailSequence, 
  useUpdateEmailSequence,
  SEQUENCE_TRIGGERS 
} from "@/hooks/useEmailSequences";

export default function Sequences() {
  const navigate = useNavigate();
  const { data: sequences, isLoading } = useEmailSequences();
  const deleteSequence = useDeleteEmailSequence();
  const updateSequence = useUpdateEmailSequence();
  
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteSequence.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleActive = (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    updateSequence.mutate({ id, status: newStatus });
  };

  const getTriggerLabel = (trigger: string) => {
    return SEQUENCE_TRIGGERS.find(t => t.value === trigger)?.label || trigger;
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Sequences</h1>
          <p className="text-muted-foreground">
            Automated email campaigns that nurture your customers
          </p>
        </div>
        <Button onClick={() => navigate("/marketing/sequences/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Sequences Grid */}
      {!sequences || sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No sequences yet</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Create your first automated email sequence to nurture customers
          </p>
          <Button onClick={() => navigate("/marketing/sequences/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create Sequence
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map((sequence: any) => (
            <Card 
              key={sequence.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/marketing/sequences/${sequence.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{sequence.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {sequence.description || "No description"}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(sequence.id, sequence.status);
                        }}
                      >
                        {sequence.status === "active" ? (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(sequence.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={sequence.status === "active" ? "default" : "secondary"}>
                    {sequence.status === "active" ? "Active" : "Paused"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {sequence.sequence_steps?.[0]?.count || 0} steps
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Trigger:</span>{" "}
                  {getTriggerLabel(sequence.trigger_type)}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{sequence.sequence_enrollments?.[0]?.count || 0} enrolled</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sequence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sequence? This will also remove all
              enrollment data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
