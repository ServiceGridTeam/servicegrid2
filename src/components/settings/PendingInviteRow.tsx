import { TeamInvite, useCancelInvite } from "@/hooks/useTeamManagement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Loader2, X, Crown, Shield, Wrench, Eye, Mail } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface PendingInviteRowProps {
  invite: TeamInvite;
}

const roleConfig: Record<AppRole, { label: string; icon: React.ReactNode }> = {
  owner: { label: "Owner", icon: <Crown className="h-3 w-3" /> },
  admin: { label: "Admin", icon: <Shield className="h-3 w-3" /> },
  technician: { label: "Technician", icon: <Wrench className="h-3 w-3" /> },
  viewer: { label: "Viewer", icon: <Eye className="h-3 w-3" /> },
};

export function PendingInviteRow({ invite }: PendingInviteRowProps) {
  const { toast } = useToast();
  const cancelInvite = useCancelInvite();
  const config = roleConfig[invite.role];

  const handleCancel = async () => {
    try {
      await cancelInvite.mutateAsync(invite.id);
      toast({ title: "Invite cancelled" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to cancel invite",
        description: error.message,
      });
    }
  };

  const expiresIn = formatDistanceToNow(new Date(invite.expires_at), {
    addSuffix: true,
  });

  const sentAgo = formatDistanceToNow(new Date(invite.created_at), {
    addSuffix: true,
  });

  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{invite.email}</p>
          <p className="text-sm text-muted-foreground">
            Sent {sentAgo} • Expires {expiresIn}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1">
          {config.icon}
          {config.label}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          disabled={cancelInvite.isPending}
          className="text-muted-foreground hover:text-destructive"
        >
          {cancelInvite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
