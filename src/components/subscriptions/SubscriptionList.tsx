import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Calendar, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { SubscriptionStatusBadge } from "./SubscriptionStatusBadge";
import { format } from "date-fns";

type StatusFilter = "all" | "active" | "paused" | "cancelled";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function SubscriptionListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SubscriptionListProps {
  customerId?: string;
}

export function SubscriptionList({ customerId }: SubscriptionListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  
  const { data: subscriptions, isLoading } = useSubscriptions({
    status: statusFilter === "all" ? undefined : statusFilter,
    customerId,
    search: search || undefined,
  });

  const handleTabChange = (value: string) => {
    // Haptic feedback on tab switch
    if (navigator.vibrate) navigator.vibrate(10);
    setStatusFilter(value as StatusFilter);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or subscription number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      {isLoading ? (
        <SubscriptionListSkeleton />
      ) : !subscriptions?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No subscriptions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {subscriptions.map((subscription, index) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
              >
                <Link to={`/subscriptions/${subscription.id}`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{subscription.name}</span>
                        <SubscriptionStatusBadge status={subscription.status} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {subscription.customer && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {subscription.customer.first_name} {subscription.customer.last_name}
                          </span>
                        )}
                        {subscription.next_service_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Next: {format(new Date(subscription.next_service_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-medium">
                        {formatCurrency(subscription.price)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {subscription.subscription_number}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
