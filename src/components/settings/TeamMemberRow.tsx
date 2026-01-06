import { useState } from "react";
import { TeamMember, useUpdateMemberRole, useRemoveTeamMember } from "@/hooks/useTeamManagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserMinus, Crown, Shield, Wrench, Eye } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface TeamMemberRowProps {
  member: TeamMember;
  isCurrentUser: boolean;
  currentUserRole?: AppRole;
  canManage: boolean;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner: { label: "Owner", icon: <Crown className="h-3 w-3" />, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  admin: { label: "Admin", icon: <Shield className="h-3 w-3" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  technician: { label: "Technician", icon: <Wrench className="h-3 w-3" />, color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  viewer: { label: "Viewer", icon: <Eye className="h-3 w-3" />, color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
};

export function TeamMemberRow({
  member,
  isCurrentUser,
  currentUserRole,
  canManage,
}: TeamMemberRowProps) {
  const { toast } = useToast();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveTeamMember();
  const [isUpdating, setIsUpdating] = useState(false);

  const initials = `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase() || "?";
  const fullName = [member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown";
  const config = roleConfig[member.role];

  // Can't modify owner or yourself
  const canModify = canManage && !isCurrentUser && member.role !== "owner";
  // Only owner can change roles to admin
  const canSetAdmin = currentUserRole === "owner";

  const handleRoleChange = async (newRole: AppRole) => {
    setIsUpdating(true);
    try {
      await updateRole.mutateAsync({ membershipId: member.membershipId, newRole });
      toast({ title: "Role updated successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update role",
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeMember.mutateAsync(member.membershipId);
      toast({ title: "Team member removed" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to remove member",
        description: error.message,
      });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.avatar_url || undefined} alt={fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{fullName}</p>
            {isCurrentUser && (
              <Badge variant="outline" className="text-xs">
                You
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {canModify ? (
          <Select
            value={member.role}
            onValueChange={(value) => handleRoleChange(value as AppRole)}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-32">
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SelectValue />
              )}
            </SelectTrigger>
            <SelectContent>
              {canSetAdmin && (
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    {roleConfig.admin.icon}
                    Admin
                  </span>
                </SelectItem>
              )}
              <SelectItem value="technician">
                <span className="flex items-center gap-2">
                  {roleConfig.technician.icon}
                  Technician
                </span>
              </SelectItem>
              <SelectItem value="viewer">
                <span className="flex items-center gap-2">
                  {roleConfig.viewer.icon}
                  Viewer
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge className={`${config.color} gap-1`}>
            {config.icon}
            {config.label}
          </Badge>
        )}

        {canModify && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                <UserMinus className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove {fullName} from your team. They will lose access
                  to all business data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {removeMember.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Remove"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
