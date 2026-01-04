import { useState } from "react";
import {
  useTeamMembers,
  useTeamInvites,
  useCanManageTeam,
} from "@/hooks/useTeamManagement";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Users } from "lucide-react";
import { TeamMemberRow } from "./TeamMemberRow";
import { PendingInviteRow } from "./PendingInviteRow";
import { InviteMemberDialog } from "./InviteMemberDialog";

export function TeamManagement() {
  const { user } = useAuth();
  const { data: members, isLoading: membersLoading } = useTeamMembers();
  const { data: invites, isLoading: invitesLoading } = useTeamInvites();
  const { data: canManage } = useCanManageTeam();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const currentUserRole = members?.find((m) => m.id === user?.id)?.role;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
              {members && (
                <Badge variant="secondary" className="ml-2">
                  {members.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Manage your team members and their roles
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border">
              {members.map((member) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  isCurrentUser={member.id === user?.id}
                  currentUserRole={currentUserRole}
                  canManage={canManage || false}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No team members found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Invites
              {invites && invites.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {invites.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : invites && invites.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border">
                {invites.map((invite) => (
                  <PendingInviteRow key={invite.id} invite={invite} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No pending invites
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
