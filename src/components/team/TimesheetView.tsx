import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTimeEntriesForDateRange, TimeEntryWithDetails } from "@/hooks/useTimeEntries";
import { useTeamMembers } from "@/hooks/useTeamManagement";
import { ChevronLeft, ChevronRight, Download, Clock } from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "?";
}

function formatMinutesToDecimal(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function TimesheetView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const { data: entries, isLoading: entriesLoading } = useTimeEntriesForDateRange(
    weekStart,
    weekEnd,
    selectedMemberId === "all" ? undefined : selectedMemberId
  );
  const { data: members, isLoading: membersLoading } = useTeamMembers();

  // Group entries by user and day
  const timesheetData = useMemo(() => {
    if (!entries || !members) return [];
    
    const memberIds = selectedMemberId === "all" 
      ? members.map((m) => m.id)
      : [selectedMemberId];
    
    return memberIds.map((memberId) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return null;
      
      const memberEntries = entries.filter((e) => e.user_id === memberId);
      
      const dailyMinutes = weekDays.map((day) => {
        const dayEntries = memberEntries.filter((e) => 
          isSameDay(new Date(e.clock_in), day)
        );
        return dayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
      });
      
      const totalMinutes = dailyMinutes.reduce((sum, m) => sum + m, 0);
      
      return {
        member,
        dailyMinutes,
        totalMinutes,
        entries: memberEntries,
      };
    }).filter(Boolean) as {
      member: { id: string; first_name: string | null; last_name: string | null; email: string; avatar_url: string | null; role: string };
      dailyMinutes: number[];
      totalMinutes: number;
      entries: TimeEntryWithDetails[];
    }[];
  }, [entries, members, selectedMemberId, weekDays]);

  const navigateWeek = (direction: "prev" | "next") => {
    setWeekStart((current) => 
      direction === "prev" ? subWeeks(current, 1) : addWeeks(current, 1)
    );
  };

  const exportCSV = () => {
    if (!timesheetData.length) return;
    
    const headers = ["Name", "Email", ...weekDays.map((d) => format(d, "EEE MM/dd")), "Total"];
    const rows = timesheetData.map((row) => [
      `${row.member.first_name} ${row.member.last_name}`,
      row.member.email,
      ...row.dailyMinutes.map((m) => formatMinutesToDecimal(m)),
      formatMinutesToDecimal(row.totalMinutes),
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${format(weekStart, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = entriesLoading || membersLoading;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <span className="font-medium">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Members</SelectItem>
              {members?.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={exportCSV} disabled={!timesheetData.length}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Timesheet Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Weekly Timesheet
          </CardTitle>
          <CardDescription>
            Hours worked by team members this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : timesheetData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Team Member
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={day.toISOString()}
                        className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[70px]"
                      >
                        <div>{format(day, "EEE")}</div>
                        <div className="text-xs">{format(day, "M/d")}</div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetData.map((row) => (
                    <tr key={row.member.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={row.member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(row.member.first_name, row.member.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {row.member.first_name} {row.member.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.member.role}
                            </p>
                          </div>
                        </div>
                      </td>
                      {row.dailyMinutes.map((minutes, i) => (
                        <td
                          key={i}
                          className={`text-center py-3 px-2 ${
                            minutes > 0 ? "font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {minutes > 0 ? formatMinutesToDecimal(minutes) : "-"}
                        </td>
                      ))}
                      <td className="text-center py-3 px-4">
                        <Badge variant="secondary" className="font-mono">
                          {formatMinutesToDecimal(row.totalMinutes)} hrs
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="py-3 px-4 font-medium">Daily Total</td>
                    {weekDays.map((day, i) => {
                      const total = timesheetData.reduce(
                        (sum, row) => sum + row.dailyMinutes[i],
                        0
                      );
                      return (
                        <td key={i} className="text-center py-3 px-2 font-medium">
                          {total > 0 ? formatMinutesToDecimal(total) : "-"}
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-4">
                      <Badge className="font-mono">
                        {formatMinutesToDecimal(
                          timesheetData.reduce((sum, row) => sum + row.totalMinutes, 0)
                        )} hrs
                      </Badge>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No time entries for this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
