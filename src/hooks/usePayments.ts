import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Payment {
  id: string;
  invoice_id: string;
  business_id: string;
  amount: number;
  payment_method: string | null;
  stripe_payment_intent_id: string | null;
  status: string | null;
  notes: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  invoice?: {
    invoice_number: string;
    customer: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
}

export interface PaymentStats {
  totalRevenue: number;
  successfulPayments: number;
  failedPayments: number;
  successRate: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueTrend: number;
}

export function usePayments() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["payments"],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          invoice:invoices(
            invoice_number,
            customer:customers(first_name, last_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });
}

export function usePaymentStats() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["payment-stats"],
    queryFn: async (): Promise<PaymentStats> => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("amount, status, paid_at, created_at");

      if (error) throw error;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const successfulPayments = payments?.filter(p => p.status === "completed") || [];
      const failedPayments = payments?.filter(p => p.status === "failed") || [];

      const totalRevenue = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      const revenueThisMonth = successfulPayments
        .filter(p => p.paid_at && new Date(p.paid_at) >= thisMonthStart)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const revenueLastMonth = successfulPayments
        .filter(p => p.paid_at && new Date(p.paid_at) >= lastMonthStart && new Date(p.paid_at) <= lastMonthEnd)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const revenueTrend = revenueLastMonth > 0 
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
        : revenueThisMonth > 0 ? 100 : 0;

      const totalPayments = successfulPayments.length + failedPayments.length;
      const successRate = totalPayments > 0 
        ? (successfulPayments.length / totalPayments) * 100 
        : 100;

      return {
        totalRevenue,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        successRate,
        revenueThisMonth,
        revenueLastMonth,
        revenueTrend,
      };
    },
    enabled: !!session,
  });
}

export function useRevenueByMonth() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["revenue-by-month"],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("amount, status, paid_at")
        .eq("status", "completed")
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyData: Record<string, number> = {};
      const now = new Date();
      
      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = date.toLocaleString("default", { month: "short", year: "2-digit" });
        monthlyData[key] = 0;
      }

      // Sum payments by month
      payments?.forEach(p => {
        if (p.paid_at) {
          const date = new Date(p.paid_at);
          const key = date.toLocaleString("default", { month: "short", year: "2-digit" });
          if (key in monthlyData) {
            monthlyData[key] += Number(p.amount);
          }
        }
      });

      return Object.entries(monthlyData).map(([month, revenue]) => ({
        month,
        revenue,
      }));
    },
    enabled: !!session,
  });
}
