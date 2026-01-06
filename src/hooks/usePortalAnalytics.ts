import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

export interface PortalAnalytics {
  totalCustomersWithAccess: number;
  totalLogins: number;
  loginsThisWeek: number;
  loginsThisMonth: number;
  pendingInvites: number;
  conversionRate: number;
  topActiveCustomers: Array<{
    customerId: string;
    customerName: string;
    loginCount: number;
    lastLogin: string;
  }>;
  loginTrend: Array<{
    date: string;
    logins: number;
  }>;
  eventBreakdown: {
    invitesSent: number;
    loginsTotal: number;
    firstLogins: number;
    accessRevoked: number;
  };
}

export function usePortalAnalytics(businessId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ["portal-analytics", businessId, days],
    queryFn: async (): Promise<PortalAnalytics> => {
      if (!businessId) {
        throw new Error("Business ID required");
      }

      const startDate = startOfDay(subDays(new Date(), days));
      const weekAgo = startOfDay(subDays(new Date(), 7));
      const monthAgo = startOfDay(subDays(new Date(), 30));

      // Fetch all data in parallel
      const [
        accessLinksResult,
        pendingInvitesResult,
        auditEventsResult,
        allInvitesResult,
      ] = await Promise.all([
        // Count customers with active access
        supabase
          .from("customer_account_links")
          .select("customer_id", { count: "exact" })
          .eq("business_id", businessId)
          .eq("status", "active"),
        
        // Count pending invites
        supabase
          .from("customer_portal_invites")
          .select("id", { count: "exact" })
          .eq("business_id", businessId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString()),
        
        // Fetch audit events for analytics
        supabase
          .from("portal_access_audit")
          .select("event_type, customer_id, created_at")
          .eq("business_id", businessId)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false }),
        
        // Count all invites for conversion rate
        supabase
          .from("customer_portal_invites")
          .select("status", { count: "exact" })
          .eq("business_id", businessId),
      ]);

      const totalCustomersWithAccess = accessLinksResult.count || 0;
      const pendingInvites = pendingInvitesResult.count || 0;
      const auditEvents = auditEventsResult.data || [];

      // Calculate event breakdown
      const eventBreakdown = {
        invitesSent: auditEvents.filter((e) => e.event_type === "invite_sent").length,
        loginsTotal: auditEvents.filter((e) => e.event_type === "login" || e.event_type === "first_login").length,
        firstLogins: auditEvents.filter((e) => e.event_type === "first_login").length,
        accessRevoked: auditEvents.filter((e) => e.event_type === "access_revoked").length,
      };

      // Calculate logins this week/month
      const loginsThisWeek = auditEvents.filter(
        (e) =>
          (e.event_type === "login" || e.event_type === "first_login") &&
          new Date(e.created_at) >= weekAgo
      ).length;

      const loginsThisMonth = auditEvents.filter(
        (e) =>
          (e.event_type === "login" || e.event_type === "first_login") &&
          new Date(e.created_at) >= monthAgo
      ).length;

      // Calculate conversion rate (accepted invites / total invites)
      let conversionRate = 0;
      if (allInvitesResult.data) {
        const acceptedCount = (allInvitesResult.data as { status: string }[]).filter(
          (i) => i.status === "accepted"
        ).length;
        const totalInvites = allInvitesResult.count || 0;
        conversionRate = totalInvites > 0 ? (acceptedCount / totalInvites) * 100 : 0;
      }

      // Calculate login trend by day
      const loginsByDay = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        loginsByDay.set(date, 0);
      }

      auditEvents
        .filter((e) => e.event_type === "login" || e.event_type === "first_login")
        .forEach((event) => {
          const date = format(new Date(event.created_at), "yyyy-MM-dd");
          if (loginsByDay.has(date)) {
            loginsByDay.set(date, (loginsByDay.get(date) || 0) + 1);
          }
        });

      const loginTrend = Array.from(loginsByDay.entries())
        .map(([date, logins]) => ({ date, logins }))
        .reverse();

      // Get top active customers
      const customerLoginCounts = new Map<string, { count: number; lastLogin: string }>();
      auditEvents
        .filter((e) => e.event_type === "login" || e.event_type === "first_login")
        .forEach((event) => {
          const existing = customerLoginCounts.get(event.customer_id);
          if (existing) {
            existing.count++;
          } else {
            customerLoginCounts.set(event.customer_id, {
              count: 1,
              lastLogin: event.created_at,
            });
          }
        });

      const topCustomerIds = Array.from(customerLoginCounts.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([id]) => id);

      let topActiveCustomers: PortalAnalytics["topActiveCustomers"] = [];
      if (topCustomerIds.length > 0) {
        const { data: customers } = await supabase
          .from("customers")
          .select("id, first_name, last_name")
          .in("id", topCustomerIds);

        if (customers) {
          topActiveCustomers = topCustomerIds.map((customerId) => {
            const customer = customers.find((c) => c.id === customerId);
            const stats = customerLoginCounts.get(customerId)!;
            return {
              customerId,
              customerName: customer
                ? `${customer.first_name} ${customer.last_name}`
                : "Unknown",
              loginCount: stats.count,
              lastLogin: stats.lastLogin,
            };
          });
        }
      }

      return {
        totalCustomersWithAccess,
        totalLogins: eventBreakdown.loginsTotal,
        loginsThisWeek,
        loginsThisMonth,
        pendingInvites,
        conversionRate,
        topActiveCustomers,
        loginTrend,
        eventBreakdown,
      };
    },
    enabled: !!businessId,
  });
}
