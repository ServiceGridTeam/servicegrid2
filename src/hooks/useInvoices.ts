import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Invoice = Tables<"invoices">;
export type InvoiceItem = Tables<"invoice_items">;
export type Payment = Tables<"payments">;

export type InvoiceWithCustomer = Invoice & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone"> | null;
};

export type InvoiceWithDetails = Invoice & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone" | "address_line1" | "address_line2" | "city" | "state" | "zip"> | null;
  invoice_items: InvoiceItem[];
  payments: Payment[];
  job: Pick<Tables<"jobs">, "id" | "job_number" | "title"> | null;
  quote: Pick<Tables<"quotes">, "id" | "quote_number" | "title"> | null;
};

interface UseInvoicesOptions {
  search?: string;
  status?: string;
  customerId?: string;
}

export function useInvoices(options?: UseInvoicesOptions) {
  return useQuery({
    queryKey: ["invoices", options],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone)
        `)
        .order("created_at", { ascending: false });

      if (options?.customerId) {
        query = query.eq("customer_id", options.customerId);
      }

      if (options?.search) {
        query = query.or(
          `invoice_number.ilike.%${options.search}%,customer.first_name.ilike.%${options.search}%,customer.last_name.ilike.%${options.search}%`
        );
      }

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as InvoiceWithCustomer[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone, address_line1, address_line2, city, state, zip),
          invoice_items(*),
          payments(*),
          job:jobs(id, job_number, title),
          quote:quotes(id, quote_number, title)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      
      // Sort invoice_items by sort_order
      if (data?.invoice_items) {
        data.invoice_items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      }
      
      // Sort payments by created_at
      if (data?.payments) {
        data.payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      return data as InvoiceWithDetails | null;
    },
    enabled: !!id,
  });
}

interface CreateInvoiceInput {
  invoice: Omit<TablesInsert<"invoices">, "invoice_number">;
  items: Omit<TablesInsert<"invoice_items">, "invoice_id">[];
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoice, items }: CreateInvoiceInput) => {
      // Get business ID
      const { data: businessData, error: businessError } = await supabase
        .rpc("get_user_business_id");

      if (businessError) throw businessError;
      if (!businessData) throw new Error("No business found");

      // Get next invoice number
      const { data: existingInvoices, error: countError } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("business_id", businessData)
        .order("created_at", { ascending: false })
        .limit(1);

      if (countError) throw countError;

      let nextNumber = 1;
      if (existingInvoices && existingInvoices.length > 0) {
        const lastNumber = existingInvoices[0].invoice_number;
        const match = lastNumber.match(/INV-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const invoiceNumber = `INV-${String(nextNumber).padStart(4, "0")}`;

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          ...invoice,
          business_id: businessData,
          invoice_number: invoiceNumber,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      if (items.length > 0) {
        const itemsWithInvoiceId = items.map((item, index) => ({
          ...item,
          invoice_id: invoiceData.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsWithInvoiceId);

        if (itemsError) throw itemsError;
      }

      return invoiceData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

type UpdateInvoiceInput = {
  id: string;
  invoice?: TablesUpdate<"invoices">;
  items?: Omit<TablesInsert<"invoice_items">, "invoice_id">[];
} & TablesUpdate<"invoices">;

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, invoice, items, ...directUpdates }: UpdateInvoiceInput) => {
      // Merge direct updates with invoice object
      const updateData = { ...directUpdates, ...invoice };
      
      // Update invoice
      const { data, error } = await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // If items provided, replace all items
      if (items) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", id);

        if (deleteError) throw deleteError;

        // Insert new items
        if (items.length > 0) {
          const itemsWithInvoiceId = items.map((item, index) => ({
            ...item,
            invoice_id: id,
            sort_order: index,
          }));

          const { error: insertError } = await supabase
            .from("invoice_items")
            .insert(itemsWithInvoiceId);

          if (insertError) throw insertError;
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.id] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export interface SendInvoiceResult {
  success: boolean;
  email_sent: boolean;
  reason?: string;
  email_id?: string;
}

export function useSendInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<SendInvoiceResult> => {
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { invoice_id: id },
      });

      if (error) {
        // Fallback: just update the status locally if edge function fails
        console.error('Email send failed, marking as sent:', error);
        await supabase
          .from("invoices")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", id);
        
        return { success: true, email_sent: false, reason: error.message };
      }

      return data as SendInvoiceResult;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

export interface SendReminderResult {
  success: boolean;
  email_sent: boolean;
  reason?: string;
  days_overdue?: number;
}

export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<SendReminderResult> => {
      const { data, error } = await supabase.functions.invoke('send-reminder-email', {
        body: { invoice_id: id },
      });

      if (error) {
        throw new Error(error.message || 'Failed to send reminder');
      }

      return data as SendReminderResult;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
    },
  });
}

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, amount, paymentMethod, notes }: RecordPaymentInput) => {
      // Get the invoice to calculate new balance
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("business_id, amount_paid, balance_due, total")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Create payment record
      const { error: paymentError } = await supabase.from("payments").insert({
        invoice_id: invoiceId,
        business_id: invoice.business_id,
        amount,
        payment_method: paymentMethod || "manual",
        notes,
        status: "completed",
        paid_at: new Date().toISOString(),
      });

      if (paymentError) throw paymentError;

      // Update invoice balance
      const newAmountPaid = Number(invoice.amount_paid || 0) + amount;
      const newBalanceDue = Number(invoice.total || 0) - newAmountPaid;
      const isPaid = newBalanceDue <= 0;

      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalanceDue),
          status: isPaid ? "paid" : "sent",
          paid_at: isPaid ? new Date().toISOString() : null,
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}
