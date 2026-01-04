import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
  id: string;
  type: "job_created" | "job_completed" | "quote_sent" | "quote_approved" | "invoice_paid" | "customer_added" | "payment_received";
  title: string;
  description: string;
  timestamp: Date;
  relativeTime: string;
  entityId: string;
  entityType: "job" | "quote" | "invoice" | "customer" | "payment";
}

export function useRecentActivity(limit = 10) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ["recent-activity", limit],
    queryFn: async (): Promise<ActivityItem[]> => {
      const activities: ActivityItem[] = [];

      // Fetch recent data from multiple tables in parallel
      const [jobsResult, quotesResult, invoicesResult, customersResult, paymentsResult] = await Promise.all([
        // Recent jobs (created or completed)
        supabase
          .from("jobs")
          .select("id, title, status, created_at, updated_at, customer:customers(first_name, last_name)")
          .order("updated_at", { ascending: false })
          .limit(10),
        
        // Recent quotes (sent or approved)
        supabase
          .from("quotes")
          .select("id, quote_number, status, sent_at, approved_at, customer:customers(first_name, last_name)")
          .in("status", ["sent", "approved"])
          .order("updated_at", { ascending: false })
          .limit(10),
        
        // Recent paid invoices
        supabase
          .from("invoices")
          .select("id, invoice_number, paid_at, customer:customers(first_name, last_name)")
          .eq("status", "paid")
          .not("paid_at", "is", null)
          .order("paid_at", { ascending: false })
          .limit(10),
        
        // Recently added customers
        supabase
          .from("customers")
          .select("id, first_name, last_name, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        
        // Recent payments
        supabase
          .from("payments")
          .select("id, amount, paid_at, invoice:invoices(invoice_number, customer:customers(first_name, last_name))")
          .eq("status", "completed")
          .order("paid_at", { ascending: false })
          .limit(10),
      ]);

      // Process jobs
      jobsResult.data?.forEach((job) => {
        const customer = job.customer as { first_name: string; last_name: string } | null;
        const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
        
        if (job.status === "completed") {
          activities.push({
            id: `job-completed-${job.id}`,
            type: "job_completed",
            title: "Job Completed",
            description: `${job.title} for ${customerName}`,
            timestamp: new Date(job.updated_at),
            relativeTime: formatDistanceToNow(new Date(job.updated_at), { addSuffix: true }),
            entityId: job.id,
            entityType: "job",
          });
        } else {
          activities.push({
            id: `job-created-${job.id}`,
            type: "job_created",
            title: "Job Created",
            description: `${job.title} for ${customerName}`,
            timestamp: new Date(job.created_at),
            relativeTime: formatDistanceToNow(new Date(job.created_at), { addSuffix: true }),
            entityId: job.id,
            entityType: "job",
          });
        }
      });

      // Process quotes
      quotesResult.data?.forEach((quote) => {
        const customer = quote.customer as { first_name: string; last_name: string } | null;
        const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
        
        if (quote.status === "approved" && quote.approved_at) {
          activities.push({
            id: `quote-approved-${quote.id}`,
            type: "quote_approved",
            title: "Quote Approved",
            description: `${quote.quote_number} by ${customerName}`,
            timestamp: new Date(quote.approved_at),
            relativeTime: formatDistanceToNow(new Date(quote.approved_at), { addSuffix: true }),
            entityId: quote.id,
            entityType: "quote",
          });
        } else if (quote.sent_at) {
          activities.push({
            id: `quote-sent-${quote.id}`,
            type: "quote_sent",
            title: "Quote Sent",
            description: `${quote.quote_number} to ${customerName}`,
            timestamp: new Date(quote.sent_at),
            relativeTime: formatDistanceToNow(new Date(quote.sent_at), { addSuffix: true }),
            entityId: quote.id,
            entityType: "quote",
          });
        }
      });

      // Process invoices
      invoicesResult.data?.forEach((invoice) => {
        const customer = invoice.customer as { first_name: string; last_name: string } | null;
        const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
        
        if (invoice.paid_at) {
          activities.push({
            id: `invoice-paid-${invoice.id}`,
            type: "invoice_paid",
            title: "Invoice Paid",
            description: `${invoice.invoice_number} by ${customerName}`,
            timestamp: new Date(invoice.paid_at),
            relativeTime: formatDistanceToNow(new Date(invoice.paid_at), { addSuffix: true }),
            entityId: invoice.id,
            entityType: "invoice",
          });
        }
      });

      // Process customers
      customersResult.data?.forEach((customer) => {
        activities.push({
          id: `customer-added-${customer.id}`,
          type: "customer_added",
          title: "Customer Added",
          description: `${customer.first_name} ${customer.last_name}`,
          timestamp: new Date(customer.created_at),
          relativeTime: formatDistanceToNow(new Date(customer.created_at), { addSuffix: true }),
          entityId: customer.id,
          entityType: "customer",
        });
      });

      // Process payments
      paymentsResult.data?.forEach((payment) => {
        const invoice = payment.invoice as { invoice_number: string; customer: { first_name: string; last_name: string } | null } | null;
        const customerName = invoice?.customer ? `${invoice.customer.first_name} ${invoice.customer.last_name}` : "Unknown";
        
        if (payment.paid_at) {
          activities.push({
            id: `payment-${payment.id}`,
            type: "payment_received",
            title: "Payment Received",
            description: `$${Number(payment.amount).toLocaleString()} from ${customerName}`,
            timestamp: new Date(payment.paid_at),
            relativeTime: formatDistanceToNow(new Date(payment.paid_at), { addSuffix: true }),
            entityId: payment.id,
            entityType: "payment",
          });
        }
      });

      // Sort by timestamp descending and limit
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return activities.slice(0, limit);
    },
    enabled: !!session,
    refetchInterval: 60000,
  });
}
