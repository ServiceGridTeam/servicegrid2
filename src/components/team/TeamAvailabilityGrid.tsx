import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Edit2, Check, X, Palmtree } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamManagement";
import { useTeamAvailability } from "@/hooks/useTeamAvailability";
import { useTimeOffRequests } from "@/hooks/useTimeOffRequests";
import { useCanManageTeam } from "@/hooks/useTeamManagement";
import { WeeklyScheduleEditor } from "./WeeklyScheduleEditor";
import { cn } from "@/lib/utils";

export function TeamAvailabilityGrid() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [editingMember, setEditingMember] = useState<{ id: string; name: string } | null>(null);
  
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: availability = [] } = useTeamAvailability();
  const { data: timeOffRequests = [] } = useTimeOffRequests({ status: "approved" });
  const { data: canManage } = useCanManageTeam();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateWeek = (direction: "prev" | "next") => {
    setWeekStart((prev) => addDays(prev, direction === "prev" ? -7 : 7));
  };

  const getAvailabilityForDay = (userId: string, date: Date) => {
    const dayOfWeek = date.getDay();
    
    // Check for approved time off on this date
    const hasTimeOff = timeOffRequests.some((request) => {
      if (request.user_id !== userId) return false;
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      return date >= start && date <= end;
    });
    
    if (hasTimeOff) {
      return { status: "time-off" as const, startTime: null, endTime: null };
    }
    
    // Check regular availability
    const dayAvailability = availability.find(
      (a) => a.user_id === userId && a.day_of_week === dayOfWeek
    );
    
    if (dayAvailability?.is_available) {
      return {
        status: "available" as const,
        startTime: dayAvailability.start_time,
        endTime: dayAvailability.end_time,
      };
    }
    
    // Default to available Mon-Fri if no record exists
    if (!dayAvailability && dayOfWeek >= 1 && dayOfWeek <= 5) {
      return { status: "available" as const, startTime: "08:00", endTime: "17:00" };
    }
    
    return { status: "unavailable" as const, startTime: null, endTime: null };
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Team Availability</CardTitle>
          <CardDescription>
            Weekly schedule overview for all team members
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Team Member</TableHead>
                {weekDays.map((day) => (
                  <TableHead
                    key={day.toISOString()}
                    className={cn(
                      "text-center min-w-[80px]",
                      isSameDay(day, new Date()) && "bg-primary/5"
                    )}
                  >
                    <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                    <div className={cn(
                      "text-sm",
                      isSameDay(day, new Date()) && "font-bold text-primary"
                    )}>
                      {format(day, "d")}
                    </div>
                  </TableHead>
                ))}
                {canManage && <TableHead className="w-[80px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.first_name, member.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {member.first_name} {member.last_name?.[0]}.
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {weekDays.map((day) => {
                    const { status, startTime, endTime } = getAvailabilityForDay(member.id, day);
                    return (
                      <TableCell
                        key={day.toISOString()}
                        className={cn(
                          "text-center",
                          isSameDay(day, new Date()) && "bg-primary/5"
                        )}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex justify-center">
                                {status === "available" && (
                                  <div className="h-6 w-6 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  </div>
                                )}
                                {status === "unavailable" && (
                                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                )}
                                {status === "time-off" && (
                                  <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <Palmtree className="h-3.5 w-3.5 text-amber-600" />
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {status === "available" && (
                                <p>{startTime} - {endTime}</p>
                              )}
                              {status === "unavailable" && <p>Not scheduled</p>}
                              {status === "time-off" && <p>Time off</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    );
                  })}
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setEditingMember({
                            id: member.id,
                            name: `${member.first_name || ""} ${member.last_name || ""}`.trim(),
                          })
                        }
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {teamMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    No team members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="h-2.5 w-2.5 text-green-600" />
            </div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center">
              <X className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
            <span>Not scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Palmtree className="h-2.5 w-2.5 text-amber-600" />
            </div>
            <span>Time off</span>
          </div>
        </div>
      </CardContent>

      {editingMember && (
        <WeeklyScheduleEditor
          userId={editingMember.id}
          userName={editingMember.name}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
        />
      )}
    </Card>
  );
}
