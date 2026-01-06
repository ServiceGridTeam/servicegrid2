import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useLaborCostTrends,
  useOvertimePatterns,
  useDayOfWeekOvertimePatterns,
  useApprovalMetrics,
  useLaborSummary,
} from "@/hooks/useTimesheetAnalytics";
import { subWeeks, subMonths, startOfDay, endOfDay } from "date-fns";
import { DollarSign, Clock, TrendingUp, TrendingDown, CheckCircle2, XCircle, AlertCircle, Users } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

const DATE_RANGES = [
  { value: "1w", label: "Last 7 days" },
  { value: "2w", label: "Last 2 weeks" },
  { value: "1m", label: "Last month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
];

function getDateRange(range: string): { start: Date; end: Date } {
  const end = endOfDay(new Date());
  let start: Date;

  switch (range) {
    case "1w":
      start = startOfDay(subWeeks(end, 1));
      break;
    case "2w":
      start = startOfDay(subWeeks(end, 2));
      break;
    case "1m":
      start = startOfDay(subMonths(end, 1));
      break;
    case "3m":
      start = startOfDay(subMonths(end, 3));
      break;
    case "6m":
      start = startOfDay(subMonths(end, 6));
      break;
    default:
      start = startOfDay(subWeeks(end, 2));
  }

  return { start, end };
}

function getGranularity(range: string): "daily" | "weekly" | "monthly" {
  switch (range) {
    case "1w":
    case "2w":
      return "daily";
    case "1m":
      return "weekly";
    default:
      return "monthly";
  }
}

function SummaryCard({
  title,
  value,
  change,
  icon: Icon,
  format = "number",
}: {
  title: string;
  value: number;
  change?: number;
  icon: typeof DollarSign;
  format?: "number" | "currency" | "hours" | "percent";
}) {
  const formatValue = (val: number) => {
    switch (format) {
      case "currency":
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "hours":
        return `${val.toFixed(1)}h`;
      case "percent":
        return `${val.toFixed(1)}%`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{formatValue(value)}</p>
            {change !== undefined && (
              <div className={`flex items-center gap-1 text-xs ${change >= 0 ? "text-green-600" : "text-red-600"}`}>
                {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{Math.abs(change).toFixed(1)}% vs previous</span>
              </div>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LaborCostChart({
  data,
  isLoading,
}: {
  data: { label: string; regularCost: number; overtimeCost: number; totalCost: number }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  const chartConfig = {
    regularCost: { label: "Regular", color: "hsl(var(--chart-1))" },
    overtimeCost: { label: "Overtime", color: "hsl(var(--chart-2))" },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => `$${val}`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line type="monotone" dataKey="regularCost" name="Regular" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="overtimeCost" name="Overtime" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  );
}

function OvertimePatternsChart({
  data,
  isLoading,
}: {
  data: { userName: string; regularHours: number; overtimeHours: number }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  const chartData = data.slice(0, 10); // Top 10 employees

  const chartConfig = {
    regularHours: { label: "Regular", color: "hsl(var(--chart-1))" },
    overtimeHours: { label: "Overtime", color: "hsl(var(--chart-2))" },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <YAxis dataKey="userName" type="category" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} width={75} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="regularHours" name="Regular" stackId="hours" fill="hsl(var(--chart-1))" />
        <Bar dataKey="overtimeHours" name="Overtime" stackId="hours" fill="hsl(var(--chart-2))" />
      </BarChart>
    </ChartContainer>
  );
}

function DayOfWeekChart({
  data,
  isLoading,
}: {
  data: { dayOfWeek: string; regularHours: number; overtimeHours: number }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  const chartConfig = {
    regularHours: { label: "Regular", color: "hsl(var(--chart-1))" },
    overtimeHours: { label: "Overtime", color: "hsl(var(--chart-2))" },
  };

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="dayOfWeek" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="regularHours" name="Regular" stackId="hours" fill="hsl(var(--chart-1))" />
        <Bar dataKey="overtimeHours" name="Overtime" stackId="hours" fill="hsl(var(--chart-2))" />
      </BarChart>
    </ChartContainer>
  );
}

function ApprovalStatusPieChart({ data, isLoading }: { data: { name: string; value: number; color: string }[]; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-[250px] w-full" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.name}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TimesheetAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState("2w");
  const { start, end } = getDateRange(dateRange);
  const granularity = getGranularity(dateRange);

  const { data: summary, isLoading: summaryLoading } = useLaborSummary(start, end);
  const { data: trends, isLoading: trendsLoading } = useLaborCostTrends(start, end, granularity);
  const { data: overtimePatterns, isLoading: overtimeLoading } = useOvertimePatterns(start, end);
  const { data: dayOfWeekData, isLoading: dayOfWeekLoading } = useDayOfWeekOvertimePatterns(start, end);
  const { data: approvalMetrics, isLoading: approvalLoading } = useApprovalMetrics(start, end);

  const pieChartData = approvalMetrics
    ? [
        { name: "Approved", value: approvalMetrics.totalApproved, color: "hsl(var(--chart-1))" },
        { name: "Rejected", value: approvalMetrics.totalRejected, color: "hsl(var(--destructive))" },
        { name: "Pending", value: approvalMetrics.totalPending, color: "hsl(var(--chart-3))" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Header with date range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Timesheet Analytics</h2>
          <p className="text-muted-foreground">Labor costs, overtime patterns, and approval metrics</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Labor Cost"
          value={summary?.current.totalCost || 0}
          change={summary?.costChange}
          icon={DollarSign}
          format="currency"
        />
        <SummaryCard
          title="Total Hours Worked"
          value={summary?.current.totalHours || 0}
          change={summary?.hoursChange}
          icon={Clock}
          format="hours"
        />
        <SummaryCard
          title="Overtime Hours"
          value={summary?.current.overtimeHours || 0}
          change={summary?.overtimeChange}
          icon={TrendingUp}
          format="hours"
        />
        <SummaryCard
          title="Approval Rate"
          value={approvalMetrics?.approvalRate || 0}
          icon={CheckCircle2}
          format="percent"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Labor Cost Trends */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Labor Cost Trends</CardTitle>
            <CardDescription>Regular vs overtime costs over time</CardDescription>
          </CardHeader>
          <CardContent>
            <LaborCostChart data={trends || []} isLoading={trendsLoading} />
          </CardContent>
        </Card>

        {/* Overtime Patterns by Employee */}
        <Card>
          <CardHeader>
            <CardTitle>Overtime by Employee</CardTitle>
            <CardDescription>Top 10 employees by hours worked</CardDescription>
          </CardHeader>
          <CardContent>
            <OvertimePatternsChart data={overtimePatterns || []} isLoading={overtimeLoading} />
          </CardContent>
        </Card>

        {/* Overtime by Day of Week */}
        <Card>
          <CardHeader>
            <CardTitle>Hours by Day of Week</CardTitle>
            <CardDescription>Distribution of work hours across weekdays</CardDescription>
          </CardHeader>
          <CardContent>
            <DayOfWeekChart data={dayOfWeekData || []} isLoading={dayOfWeekLoading} />
          </CardContent>
        </Card>

        {/* Approval Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Status Distribution</CardTitle>
            <CardDescription>Breakdown of timesheet approval statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ApprovalStatusPieChart data={pieChartData} isLoading={approvalLoading} />
          </CardContent>
        </Card>

        {/* Approval Details */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Metrics</CardTitle>
            <CardDescription>Key performance indicators for approvals</CardDescription>
          </CardHeader>
          <CardContent>
            {approvalLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Avg. Approval Time</span>
                  </div>
                  <span className="font-medium">{(approvalMetrics?.avgApprovalTimeHours || 0).toFixed(1)} hours</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Approval Rate</span>
                  </div>
                  <span className="font-medium text-green-600">{(approvalMetrics?.approvalRate || 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Rejection Rate</span>
                  </div>
                  <span className="font-medium text-destructive">{(approvalMetrics?.rejectionRate || 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Pending Approvals</span>
                  </div>
                  <span className="font-medium">{approvalMetrics?.totalPending || 0}</span>
                </div>

                {/* Pending by Age */}
                {approvalMetrics && approvalMetrics.totalPending > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Pending by Age</p>
                    <div className="grid grid-cols-2 gap-2">
                      {approvalMetrics.pendingByAge.map((item) => (
                        <div key={item.label} className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
