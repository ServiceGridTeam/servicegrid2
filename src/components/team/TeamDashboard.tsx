import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamTimeStats } from "@/hooks/useTimeEntries";
import { useTeamMembers } from "@/hooks/useTeamManagement";
import { Clock, Users, Briefcase, Timer } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";

function formatMinutesToHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "?";
}

export function TeamDashboard() {
  const { data: stats, isLoading: statsLoading } = useTeamTimeStats();
  const { data: members, isLoading: membersLoading } = useTeamMembers();

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Now</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.activeEntries?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  technicians working
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.todayHours?.toFixed(1) || "0"} hrs
                </div>
                <p className="text-xs text-muted-foreground">
                  logged across team
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Worked</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats?.todayEntries?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  time entries today
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Currently Working */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Currently Working
          </CardTitle>
          <CardDescription>
            Team members who are clocked in right now
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.activeEntries && stats.activeEntries.length > 0 ? (
            <div className="space-y-4">
              {stats.activeEntries.map((entry) => {
                const minutesWorked = differenceInMinutes(new Date(), new Date(entry.clock_in));
                const customerName = entry.job?.customer
                  ? `${entry.job.customer.first_name} ${entry.job.customer.last_name}`
                  : "";
                
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={entry.user?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(entry.user?.first_name || null, entry.user?.last_name || null)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {entry.user?.first_name} {entry.user?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {entry.job?.job_number} - {entry.job?.title || customerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {formatMinutesToHours(minutesWorked)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        since {format(new Date(entry.clock_in), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No one is currently clocked in
            </p>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
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
            All team members and their weekly hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border">
              {members.map((member) => {
                const weeklyMinutes = stats?.weeklyByUser?.[member.id] || 0;
                const isActive = stats?.activeEntries?.some((e) => e.user_id === member.id);
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.first_name, member.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                        {member.role}
                      </Badge>
                      <div className="text-right min-w-[80px]">
                        <p className="font-medium">
                          {formatMinutesToHours(weeklyMinutes)}
                        </p>
                        <p className="text-xs text-muted-foreground">this week</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No team members found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
