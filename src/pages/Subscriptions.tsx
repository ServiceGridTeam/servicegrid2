import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import {
  SubscriptionDashboard,
  SubscriptionList,
  ServicePlanManager,
} from "@/components/subscriptions";

export default function Subscriptions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "dashboard";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage recurring service plans and customer subscriptions
          </p>
        </div>
        <Button asChild>
          <Link to="/subscriptions/new">
            <Plus className="mr-2 h-4 w-4" />
            New Subscription
          </Link>
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Service Plans</TabsTrigger>
        </TabsList>

        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          <TabsContent value="dashboard" className="mt-0">
            <SubscriptionDashboard />
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-0">
            <SubscriptionList />
          </TabsContent>

          <TabsContent value="plans" className="mt-0">
            <ServicePlanManager />
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
