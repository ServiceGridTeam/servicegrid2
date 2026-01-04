import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PublicInvoiceData = Tables<"invoices"> & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone"> | null;
  business: Pick<Tables<"businesses">, "id" | "name" | "phone" | "email" | "logo_url" | "address_line1" | "city" | "state" | "zip" | "stripe_account_id" | "stripe_onboarding_complete"> | null;
  invoice_items: Tables<"invoice_items">[];
};

export function useInvoiceByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["public-invoice", token],
    queryFn: async () => {
      if (!token) throw new Error("Token is required");

      // Fetch invoice by public_token
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone),
          business:businesses(id, name, phone, email, logo_url, address_line1, city, state, zip, stripe_account_id, stripe_onboarding_complete)
        `)
        .eq("public_token", token)
        .maybeSingle();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error("Invoice not found");

      // Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...invoice,
        invoice_items: items || [],
      } as PublicInvoiceData;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
