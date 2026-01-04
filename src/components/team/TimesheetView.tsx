import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { useOvertimeSettings } from "@/hooks/useOvertimeSettings";
import { calculateWeeklyOvertime, formatMinutesToHoursDecimal } from "@/hooks/useOvertimeCalculations";
import { OvertimeBadge } from "./OvertimeBadge";
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
import { cn } from "@/lib/utils";

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.[0] || "";
  const last = lastName?.[0] || "";
  return (first + last).toUpperCase() || "?";
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
  const { settings: overtimeSettings } = useOvertimeSettings();

  // Group entries by user and day with overtime calculations
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
      
      // Calculate overtime
      const overtimeResult = calculateWeeklyOvertime(
        totalMinutes,
        overtimeSettings.weekly_threshold_hours,
        overtimeSettings.alert_threshold_percent
      );
      
      return {
        member,
        dailyMinutes,
        totalMinutes,
        overtimeResult,
        entries: memberEntries,
      };
    }).filter(Boolean) as {
      member: { id: string; first_name: string | null; last_name: string | null; email: string; avatar_url: string | null; role: string };
      dailyMinutes: number[];
      totalMinutes: number;
      overtimeResult: ReturnType<typeof calculateWeeklyOvertime>;
      entries: TimeEntryWithDetails[];
    }[];
  }, [entries, members, selectedMemberId, weekDays, overtimeSettings]);

  const navigateWeek = (direction: "prev" | "next") => {
    setWeekStart((current) => 
      direction === "prev" ? subWeeks(current, 1) : addWeeks(current, 1)
    );
  };

  const exportCSV = () => {
    if (!timesheetData.length) return;
    
    const headers = ["Name", "Email", ...weekDays.map((d) => format(d, "EEE MM/dd")), "Regular", "Overtime", "Total"];
    const rows = timesheetData.map((row) => [
      `${row.member.first_name} ${row.member.last_name}`,
      row.member.email,
      ...row.dailyMinutes.map((m) => formatMinutesToHoursDecimal(m)),
      formatMinutesToHoursDecimal(row.overtimeResult.regularMinutes),
      formatMinutesToHoursDecimal(row.overtimeResult.overtimeMinutes),
      formatMinutesToHoursDecimal(row.totalMinutes),
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

  // Calculate totals for footer
  const totalOvertimeMinutes = timesheetData.reduce((sum, row) => sum + row.overtimeResult.overtimeMinutes, 0);

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
            {overtimeSettings.enabled && totalOvertimeMinutes > 0 && (
              <span className="text-destructive ml-2">
                ({formatMinutesToHoursDecimal(totalOvertimeMinutes)}h total overtime)
              </span>
            )}
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
                    {overtimeSettings.enabled && (
                      <>
                        <th className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[70px]">
                          Regular
                        </th>
                        <th className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[70px]">
                          OT
                        </th>
                      </>
                    )}
                    <th className="text-center py-3 px-4 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetData.map((row) => {
                    const rowClass = cn(
                      "border-b transition-colors",
                      overtimeSettings.enabled && row.overtimeResult.isOvertime && "bg-destructive/5",
                      overtimeSettings.enabled && row.overtimeResult.isApproaching && !row.overtimeResult.isOvertime && "bg-yellow-500/5"
                    );
                    
                    return (
                      <tr key={row.member.id} className={rowClass}>
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
                            {minutes > 0 ? formatMinutesToHoursDecimal(minutes) : "-"}
                          </td>
                        ))}
                        {overtimeSettings.enabled && (
                          <>
                            <td className="text-center py-3 px-2 font-medium">
                              {formatMinutesToHoursDecimal(row.overtimeResult.regularMinutes)}
                            </td>
                            <td className="text-center py-3 px-2">
                              {row.overtimeResult.overtimeMinutes > 0 ? (
                                <span className="font-medium text-destructive">
                                  {formatMinutesToHoursDecimal(row.overtimeResult.overtimeMinutes)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="text-center py-3 px-4">
                          <OvertimeBadge
                            result={row.overtimeResult}
                            thresholdHours={overtimeSettings.weekly_threshold_hours}
                            showDetails
                          />
                        </td>
                      </tr>
                    );
                  })}
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
                          {total > 0 ? formatMinutesToHoursDecimal(total) : "-"}
                        </td>
                      );
                    })}
                    {overtimeSettings.enabled && (
                      <>
                        <td className="text-center py-3 px-2 font-medium">
                          {formatMinutesToHoursDecimal(
                            timesheetData.reduce((sum, row) => sum + row.overtimeResult.regularMinutes, 0)
                          )}
                        </td>
                        <td className="text-center py-3 px-2 font-medium text-destructive">
                          {totalOvertimeMinutes > 0
                            ? formatMinutesToHoursDecimal(totalOvertimeMinutes)
                            : "-"}
                        </td>
                      </>
                    )}
                    <td className="text-center py-3 px-4 font-bold">
                      {formatMinutesToHoursDecimal(
                        timesheetData.reduce((sum, row) => sum + row.totalMinutes, 0)
                      )} hrs
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
