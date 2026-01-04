import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface DashboardStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  todaysJobs: Array<{
    id: string;
    title: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    status: string | null;
    customer: { first_name: string; last_name: string } | null;
    assignee: { first_name: string | null; last_name: string | null } | null;
  }>;
  todaysJobsCompleted: number;
  pendingQuotes: number;
  pendingQuotesValue: number;
  outstandingInvoices: number;
  outstandingAmount: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTrend: number;
}

export function useDashboardStats() {
  const { session } = useAuth();
  const today = new Date();
  const todayStart = startOfDay(today).toISOString();
  const todayEnd = endOfDay(today).toISOString();
  const monthStart = startOfMonth(today).toISOString();
  const monthEnd = endOfMonth(today).toISOString();
  const lastMonthStart = startOfMonth(subMonths(today, 1)).toISOString();
  const lastMonthEnd = endOfMonth(subMonths(today, 1)).toISOString();

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      // Fetch all stats in parallel
      const [
        customersResult,
        newCustomersResult,
        todaysJobsResult,
        pendingQuotesResult,
        outstandingInvoicesResult,
        revenueThisMonthResult,
        revenueLastMonthResult,
      ] = await Promise.all([
        // Total customers
        supabase.from("customers").select("id", { count: "exact", head: true }),
        
        // New customers this month
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
        
        // Today's jobs with customer and assignee
        supabase
          .from("jobs")
          .select("id, title, scheduled_start, scheduled_end, status, customer:customers(first_name, last_name), assignee:profiles(first_name, last_name)")
          .gte("scheduled_start", todayStart)
          .lt("scheduled_start", todayEnd)
          .order("scheduled_start", { ascending: true }),
        
        // Pending quotes (sent status)
        supabase
          .from("quotes")
          .select("id, total")
          .eq("status", "sent"),
        
        // Outstanding invoices (sent or overdue)
        supabase
          .from("invoices")
          .select("id, balance_due")
          .in("status", ["sent", "overdue"]),
        
        // Revenue this month (completed payments)
        supabase
          .from("payments")
          .select("amount")
          .eq("status", "completed")
          .gte("paid_at", monthStart)
          .lte("paid_at", monthEnd),
        
        // Revenue last month
        supabase
          .from("payments")
          .select("amount")
          .eq("status", "completed")
          .gte("paid_at", lastMonthStart)
          .lte("paid_at", lastMonthEnd),
      ]);

      // Calculate totals
      const totalCustomers = customersResult.count ?? 0;
      const newCustomersThisMonth = newCustomersResult.count ?? 0;
      
      const todaysJobs = (todaysJobsResult.data ?? []) as DashboardStats["todaysJobs"];
      const todaysJobsCompleted = todaysJobs.filter(j => j.status === "completed").length;
      
      const pendingQuotes = pendingQuotesResult.data?.length ?? 0;
      const pendingQuotesValue = pendingQuotesResult.data?.reduce((sum, q) => sum + (Number(q.total) || 0), 0) ?? 0;
      
      const outstandingInvoices = outstandingInvoicesResult.data?.length ?? 0;
      const outstandingAmount = outstandingInvoicesResult.data?.reduce((sum, i) => sum + (Number(i.balance_due) || 0), 0) ?? 0;
      
      const revenueThisMonth = revenueThisMonthResult.data?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;
      const revenueLastMonth = revenueLastMonthResult.data?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) ?? 0;
      
      // Calculate trend percentage
      const revenueTrend = revenueLastMonth > 0 
        ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
        : revenueThisMonth > 0 ? 100 : 0;

      return {
        totalCustomers,
        newCustomersThisMonth,
        todaysJobs,
        todaysJobsCompleted,
        pendingQuotes,
        pendingQuotesValue,
        outstandingInvoices,
        outstandingAmount,
        revenueThisMonth,
        revenueLastMonth,
        revenueTrend,
      };
    },
    enabled: !!session,
    refetchInterval: 60000, // Refetch every minute
  });
}
