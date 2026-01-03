import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PublicQuoteData = Tables<"quotes"> & {
  customer: Pick<Tables<"customers">, "first_name" | "last_name" | "email" | "phone"> | null;
  business: Pick<Tables<"businesses">, "id" | "name" | "phone" | "email" | "logo_url" | "address_line1" | "city" | "state" | "zip"> | null;
  quote_items: Tables<"quote_items">[];
};

export function useQuoteByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["public-quote", token],
    queryFn: async () => {
      if (!token) throw new Error("Token is required");

      // Fetch quote by public_token
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select(`
          *,
          customer:customers(first_name, last_name, email, phone),
          business:businesses(id, name, phone, email, logo_url, address_line1, city, state, zip)
        `)
        .eq("public_token", token)
        .maybeSingle();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error("Quote not found");

      // Fetch quote items
      const { data: items, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quote.id)
        .order("sort_order", { ascending: true });

      if (itemsError) throw itemsError;

      // Update view count and status if first view
      if (quote.status === "sent") {
        await supabase
          .from("quotes")
          .update({ 
            status: "viewed",
            view_count: (quote.view_count || 0) + 1 
          })
          .eq("id", quote.id);
      } else {
        await supabase
          .from("quotes")
          .update({ view_count: (quote.view_count || 0) + 1 })
          .eq("id", quote.id);
      }

      return {
        ...quote,
        quote_items: items || [],
      } as PublicQuoteData;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface ApproveQuoteInput {
  id: string;
  signature_url: string;
  approved_by: string;
}

export function useApproveQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, signature_url, approved_by }: ApproveQuoteInput) => {
      const { data, error } = await supabase
        .from("quotes")
        .update({
          status: "approved",
          signature_url,
          approved_by,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["public-quote"] });
      queryClient.invalidateQueries({ queryKey: ["quote", data.id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export function useDeclineQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("quotes")
        .update({ status: "declined" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["public-quote"] });
      queryClient.invalidateQueries({ queryKey: ["quote", data.id] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
