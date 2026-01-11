import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, User, DollarSign, Clock, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  SubscriptionStatusBadge,
  SubscriptionActionsDropdown,
  ScheduleList,
  type SubscriptionSchedule,
} from "@/components/subscriptions";
import { useSubscription } from "@/hooks/useSubscriptions";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 Weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: subscription, isLoading, error } = useSubscription(id);
  const [activeTab, setActiveTab] = useState("overview");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Subscription not found.</p>
        <Button variant="link" onClick={() => navigate("/subscriptions?tab=subscriptions")}>
          Back to Subscriptions
        </Button>
      </div>
    );
  }

  const customerName = subscription.customer
    ? `${subscription.customer.first_name} ${subscription.customer.last_name}`
    : "Unknown Customer";

  // Transform database schedules to component format
  const schedules: SubscriptionSchedule[] = (subscription.subscription_schedules || []).map((s) => ({
    id: s.id,
    subscription_id: s.subscription_id,
    scheduled_date: s.scheduled_date,
    scheduled_time_start: null,
    scheduled_time_end: null,
    status: s.status as SubscriptionSchedule["status"],
    version: s.version,
    job_id: s.job_id,
    skipped_at: s.skipped_at,
    skip_reason: s.skip_reason,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/subscriptions?tab=subscriptions")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {subscription.name || `Subscription ${subscription.subscription_number}`}
              </h1>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            <p className="text-muted-foreground">
              {subscription.subscription_number} • {customerName}
            </p>
          </div>
        </div>
        <SubscriptionActionsDropdown
          subscriptionId={subscription.id}
          status={subscription.status}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          <TabsContent value="overview" className="mt-0">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <Link
                        to={`/customers/${subscription.customer_id}`}
                        className="text-lg font-medium hover:underline"
                      >
                        {customerName}
                      </Link>
                      {subscription.customer?.email && (
                        <p className="text-sm text-muted-foreground">
                          {subscription.customer.email}
                        </p>
                      )}
                      {subscription.customer?.phone && (
                        <p className="text-sm text-muted-foreground">
                          {subscription.customer.phone}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Service Plan */}
                {subscription.service_plan && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Service Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="font-medium">{subscription.service_plan.name}</p>
                        {subscription.service_plan.description && (
                          <p className="text-sm text-muted-foreground">
                            {subscription.service_plan.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Line Items */}
                {subscription.subscription_items && subscription.subscription_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Line Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {subscription.subscription_items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center py-2 border-b last:border-0"
                          >
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <p className="text-sm text-muted-foreground">
                                Qty: {item.quantity}
                              </p>
                            </div>
                            <p className="font-medium">
                              {formatCurrency(Number(item.unit_price) * item.quantity)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                {subscription.internal_notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm">
                        {subscription.internal_notes}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right column - Summary */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Pricing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price</span>
                      <span className="font-semibold text-lg">
                        {formatCurrency(Number(subscription.price))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frequency</span>
                      <span>{frequencyLabels[subscription.frequency] || subscription.frequency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Billing</span>
                      <span className="capitalize">Per Visit</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Date</span>
                      <span>
                        {format(new Date(subscription.start_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    {subscription.end_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">End Date</span>
                        <span>
                          {format(new Date(subscription.end_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    {subscription.next_billing_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Next Billing</span>
                        <span>
                          {format(new Date(subscription.next_billing_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span>
                        {format(new Date(subscription.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled Visits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleList
                  schedules={schedules}
                  isLoading={false}
                  subscriptionId={subscription.id}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Activity tracking will show subscription events like status changes,
                  payments, and schedule updates.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
