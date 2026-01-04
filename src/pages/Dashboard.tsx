import { useProfile } from "@/hooks/useProfile";
import { useBusiness } from "@/hooks/useBusiness";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileText,
  Briefcase,
  Receipt,
  DollarSign,
  Clock,
  CheckCircle,
  Plus,
  ArrowRight,
  Zap,
  TrendingUp,
  TrendingDown,
  Send,
  UserPlus,
  CreditCard,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

// Stats card component
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-all">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs mt-1">
          {trend && (
            <span className={`flex items-center gap-0.5 ${trendUp ? "text-green-600 dark:text-green-400" : trendUp === false ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
              {trendUp === true && <TrendingUp className="h-3 w-3" />}
              {trendUp === false && <TrendingDown className="h-3 w-3" />}
              {trend}
            </span>
          )}
          <span className="text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick action button component
function QuickAction({
  title,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link to={href}>
      <Card className="group cursor-pointer hover:border-foreground/20">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-all duration-200">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
        </CardContent>
      </Card>
    </Link>
  );
}

// Activity icon mapping
function getActivityIcon(type: string) {
  switch (type) {
    case "job_created":
    case "job_completed":
      return Briefcase;
    case "quote_sent":
    case "quote_approved":
      return FileText;
    case "invoice_paid":
      return Receipt;
    case "customer_added":
      return UserPlus;
    case "payment_received":
      return CreditCard;
    default:
      return Clock;
  }
}

// Recent activity item
function ActivityItem({
  title,
  description,
  time,
  icon: Icon,
}: {
  title: string;
  description: string;
  time: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-sm text-muted-foreground truncate">{description}</div>
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">{time}</div>
    </div>
  );
}

// Today's job item
function TodayJobItem({
  job,
}: {
  job: {
    id: string;
    title: string;
    scheduled_start: string | null;
    status: string | null;
    customer: { first_name: string; last_name: string } | null;
    assignee: { first_name: string | null; last_name: string | null } | null;
  };
}) {
  const startTime = job.scheduled_start ? format(new Date(job.scheduled_start), "h:mm a") : "TBD";
  const customerName = job.customer ? `${job.customer.first_name} ${job.customer.last_name}` : "No customer";
  const assigneeName = job.assignee?.first_name ? `${job.assignee.first_name} ${job.assignee.last_name || ""}`.trim() : "Unassigned";
  const isCompleted = job.status === "completed";

  return (
    <Link to={`/jobs`} className="block">
      <div className={`flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${isCompleted ? "opacity-60" : ""}`}>
        <div className="flex flex-col items-center justify-center min-w-[60px] text-center">
          <span className="text-sm font-medium">{startTime}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{job.title}</span>
            {isCompleted && (
              <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">Done</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {customerName} • {assigneeName}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: business, isLoading: businessLoading } = useBusiness();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity(8);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const isLoading = profileLoading || businessLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Stats values
  const totalCustomers = stats?.totalCustomers ?? 0;
  const newCustomersThisMonth = stats?.newCustomersThisMonth ?? 0;
  const todaysJobs = stats?.todaysJobs ?? [];
  const todaysJobsCompleted = stats?.todaysJobsCompleted ?? 0;
  const pendingQuotes = stats?.pendingQuotes ?? 0;
  const pendingQuotesValue = stats?.pendingQuotesValue ?? 0;
  const outstandingInvoices = stats?.outstandingInvoices ?? 0;
  const outstandingAmount = stats?.outstandingAmount ?? 0;
  const revenueThisMonth = stats?.revenueThisMonth ?? 0;
  const revenueTrend = stats?.revenueTrend ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {profile?.first_name || "there"}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with{" "}
            <span className="text-foreground font-medium">{business?.name || "your business"}</span> today.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              New Customer
            </Link>
          </Button>
          <Button asChild>
            <Link to="/jobs/new">
              <Zap className="mr-2 h-4 w-4" />
              New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard
              title="Total Customers"
              value={totalCustomers.toString()}
              description={newCustomersThisMonth > 0 ? `${newCustomersThisMonth} new this month` : "Start adding customers"}
              icon={Users}
            />
            <StatCard
              title="Today's Jobs"
              value={todaysJobs.length.toString()}
              description={todaysJobs.length > 0 ? `${todaysJobsCompleted} completed, ${todaysJobs.length - todaysJobsCompleted} remaining` : "No jobs scheduled"}
              icon={Briefcase}
            />
            <StatCard
              title="Pending Quotes"
              value={pendingQuotes.toString()}
              description={pendingQuotes > 0 ? `${formatCurrency(pendingQuotesValue)} total value` : "Send quotes to get started"}
              icon={FileText}
            />
            <StatCard
              title="Outstanding Invoices"
              value={outstandingInvoices.toString()}
              description={outstandingInvoices > 0 ? `${formatCurrency(outstandingAmount)} balance due` : "All invoices paid"}
              icon={Receipt}
            />
            <StatCard
              title="Revenue This Month"
              value={formatCurrency(revenueThisMonth)}
              description="vs last month"
              trend={revenueTrend !== 0 ? `${revenueTrend > 0 ? "+" : ""}${revenueTrend}%` : undefined}
              trendUp={revenueTrend > 0 ? true : revenueTrend < 0 ? false : undefined}
              icon={DollarSign}
            />
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common tasks to get things done</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              title="Add New Customer"
              description="Create a customer record"
              icon={Users}
              href="/customers/new"
            />
            <QuickAction
              title="Create Quote"
              description="Send a quote to a customer"
              icon={FileText}
              href="/quotes/new"
            />
            <QuickAction
              title="Schedule Job"
              description="Add a job to the calendar"
              icon={Briefcase}
              href="/jobs/new"
            />
            <QuickAction
              title="Create Invoice"
              description="Bill a customer for completed work"
              icon={Receipt}
              href="/invoices/new"
            />
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>What's been happening lately</CardDescription>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : activities && activities.length > 0 ? (
              <div>
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    title={activity.title}
                    description={activity.description}
                    time={activity.relativeTime}
                    icon={getActivityIcon(activity.type)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No activity yet</p>
                <p className="text-sm text-muted-foreground">
                  Your recent activity will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Today's Schedule</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/calendar">View Calendar</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : todaysJobs.length > 0 ? (
            <div className="space-y-2">
              {todaysJobs.map((job) => (
                <TodayJobItem key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-3">
                <CheckCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No jobs scheduled today</p>
              <p className="text-sm text-muted-foreground mb-4">
                Schedule your first job to see it here
              </p>
              <Button variant="outline" asChild>
                <Link to="/jobs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule a Job
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
