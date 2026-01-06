import { usePortalAnalytics } from "@/hooks/usePortalAnalytics";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Users, LogIn, Mail, TrendingUp, UserCheck, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: typeof Users;
  trend?: number;
}

function StatCard({ title, value, description, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp
              className={`h-3 w-3 ${trend >= 0 ? "text-green-500" : "text-red-500 rotate-180"}`}
            />
            <span className={`text-xs ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}% from last period
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

const chartConfig: ChartConfig = {
  logins: {
    label: "Logins",
    color: "hsl(var(--primary))",
  },
};

export function PortalAnalyticsDashboard() {
  const { activeBusinessId } = useBusinessContext();
  const { data: analytics, isLoading, error } = usePortalAnalytics(activeBusinessId, 30);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load portal analytics
        </CardContent>
      </Card>
    );
  }

  const formattedTrend = analytics.loginTrend.map((item) => ({
    ...item,
    displayDate: format(new Date(item.date), "MMM d"),
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Portal Users"
          value={analytics.totalCustomersWithAccess}
          description="Customers with portal access"
          icon={Users}
        />
        <StatCard
          title="Logins This Week"
          value={analytics.loginsThisWeek}
          description={`${analytics.loginsThisMonth} this month`}
          icon={LogIn}
        />
        <StatCard
          title="Pending Invites"
          value={analytics.pendingInvites}
          description="Awaiting customer response"
          icon={Mail}
        />
        <StatCard
          title="Conversion Rate"
          value={`${analytics.conversionRate.toFixed(1)}%`}
          description="Invites accepted"
          icon={UserCheck}
        />
      </div>

      {/* Login Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Login Trend</CardTitle>
          <CardDescription>Portal logins over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <AreaChart data={formattedTrend}>
              <defs>
                <linearGradient id="fillLogins" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="logins"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#fillLogins)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Most Active Customers</CardTitle>
            <CardDescription>Top customers by portal logins</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topActiveCustomers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No login activity yet
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {analytics.topActiveCustomers.map((customer, index) => (
                    <div
                      key={customer.customerId}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <Link
                          to={`/customers/${customer.customerId}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {customer.customerName}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{customer.loginCount} logins</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(customer.lastLogin), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Event Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Portal events in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Invites Sent</span>
                </div>
                <Badge variant="outline">{analytics.eventBreakdown.invitesSent}</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">First-Time Logins</span>
                </div>
                <Badge variant="outline">{analytics.eventBreakdown.firstLogins}</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Total Logins</span>
                </div>
                <Badge variant="outline">{analytics.eventBreakdown.loginsTotal}</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Access Revoked</span>
                </div>
                <Badge variant="outline">{analytics.eventBreakdown.accessRevoked}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
