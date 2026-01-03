import { useProfile } from "@/hooks/useProfile";
import { useBusiness } from "@/hooks/useBusiness";
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
} from "lucide-react";
import { Link } from "react-router-dom";

// Stats card component with neon glow
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
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:shadow-glow-sm transition-all">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-display text-glow">{value}</div>
        <div className="flex items-center gap-1 text-xs mt-1">
          {trend && (
            <span className={trendUp ? "text-success" : "text-destructive"}>
              {trend}
            </span>
          )}
          <span className="text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick action button component with hover glow
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
      <Card className="group cursor-pointer hover:border-accent/50">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-glow-accent transition-all duration-300">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium font-display">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
        </CardContent>
      </Card>
    </Link>
  );
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
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 border border-border/50">
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

export default function Dashboard() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: business, isLoading: businessLoading } = useBusiness();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (profileLoading || businessLoading) {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-glow">
            {greeting()}, {profile?.first_name || "there"}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with{" "}
            <span className="text-accent">{business?.name || "your business"}</span> today.
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Customers"
          value="0"
          description="Start adding customers"
          icon={Users}
        />
        <StatCard
          title="Active Jobs"
          value="0"
          description="No jobs scheduled"
          icon={Briefcase}
        />
        <StatCard
          title="Pending Quotes"
          value="0"
          description="Send quotes to get started"
          icon={FileText}
        />
        <StatCard
          title="Revenue This Month"
          value="$0"
          description="Track your earnings"
          icon={DollarSign}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30 border border-border/50 mb-3">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium font-display">No activity yet</p>
              <p className="text-sm text-muted-foreground">
                Your recent activity will appear here
              </p>
            </div>
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 border border-success/30 mb-3 shadow-[0_0_15px_-5px_hsl(var(--success)/0.4)]">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <p className="font-medium font-display">No jobs scheduled today</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
