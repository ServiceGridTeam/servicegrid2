import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  RefreshCw, 
  Pause, 
  DollarSign, 
  Calendar,
  AlertCircle,
  User,
  Clock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  useSubscriptionStats, 
  useUpcomingServices, 
  useRecentSubscriptionEvents 
} from "@/hooks/useSubscriptionDashboard";
import { format } from "date-fns";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  isLoading?: boolean;
}

function StatCard({ title, value, icon, description, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const eventTypeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  created: { label: "Created", icon: <RefreshCw className="h-3 w-3" /> },
  activated: { label: "Activated", icon: <RefreshCw className="h-3 w-3" /> },
  paused: { label: "Paused", icon: <Pause className="h-3 w-3" /> },
  resumed: { label: "Resumed", icon: <RefreshCw className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", icon: <AlertCircle className="h-3 w-3" /> },
  skipped: { label: "Skipped", icon: <Calendar className="h-3 w-3" /> },
  job_generated: { label: "Job Created", icon: <Calendar className="h-3 w-3" /> },
  invoice_generated: { label: "Invoice Created", icon: <DollarSign className="h-3 w-3" /> },
  payment_received: { label: "Payment Received", icon: <DollarSign className="h-3 w-3" /> },
  payment_failed: { label: "Payment Failed", icon: <AlertCircle className="h-3 w-3" /> },
};

export function SubscriptionDashboard() {
  const { data: stats, isLoading: statsLoading } = useSubscriptionStats();
  const { data: upcomingServices, isLoading: upcomingLoading } = useUpcomingServices(14);
  const { data: recentEvents, isLoading: eventsLoading } = useRecentSubscriptionEvents(10);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <StatCard
            title="Active Subscriptions"
            value={stats?.active_count ?? 0}
            icon={<RefreshCw className="h-4 w-4" />}
            isLoading={statsLoading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <StatCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(stats?.monthly_recurring_revenue ?? 0)}
            icon={<DollarSign className="h-4 w-4" />}
            isLoading={statsLoading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Upcoming Services"
            value={stats?.upcoming_services_count ?? 0}
            description="Next 14 days"
            icon={<Calendar className="h-4 w-4" />}
            isLoading={statsLoading}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <StatCard
            title="Paused"
            value={stats?.paused_count ?? 0}
            icon={<Pause className="h-4 w-4" />}
            isLoading={statsLoading}
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Services</CardTitle>
            <CardDescription>Next 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : !upcomingServices?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming services scheduled
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingServices.map((service) => (
                  <Link 
                    key={service.id} 
                    to={`/subscriptions/${service.subscription_id}`}
                    className="block"
                  >
                    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium truncate">{service.subscription_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">{service.customer_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {format(new Date(service.scheduled_date), "MMM d")}
                          </p>
                          {service.scheduled_time_start && (
                            <p className="text-xs text-muted-foreground">
                              {service.scheduled_time_start}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Latest subscription events</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !recentEvents?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent events
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => {
                  const eventConfig = eventTypeLabels[event.event_type] || {
                    label: event.event_type,
                    icon: <Clock className="h-3 w-3" />,
                  };
                  
                  return (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                        {eventConfig.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {eventConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {event.notes && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {event.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
