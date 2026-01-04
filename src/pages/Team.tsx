import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import { useCanManageTeam } from "@/hooks/useTeamManagement";
import { TeamDashboard } from "@/components/team/TeamDashboard";
import { TimesheetView } from "@/components/team/TimesheetView";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { InviteMemberDialog } from "@/components/settings/InviteMemberDialog";
import { OvertimeSettingsCard } from "@/components/team/OvertimeSettingsCard";

export default function Team() {
  const { data: canManage } = useCanManageTeam();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            Manage your team and track time
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          {canManage && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <TeamDashboard />
        </TabsContent>

        <TabsContent value="timesheets" className="space-y-6">
          <TimesheetView />
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <TeamManagement />
        </TabsContent>

        {canManage && (
          <TabsContent value="settings" className="space-y-6">
            <OvertimeSettingsCard />
          </TabsContent>
        )}
      </Tabs>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  );
}
