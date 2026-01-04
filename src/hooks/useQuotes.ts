import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;
export type QuoteWithCustomer = Quote & {
  customer: Tables<"customers"> | null;
};
export type QuoteWithDetails = QuoteWithCustomer & {
  quote_items: QuoteItem[];
};

interface UseQuotesOptions {
  search?: string;
  status?: string;
}

export function useQuotes(options?: UseQuotesOptions) {
  return useQuery({
    queryKey: ["quotes", options?.search, options?.status],
    queryFn: async () => {
      let query = supabase
        .from("quotes")
        .select(`
          *,
          customer:customers(*)
        `)
        .order("created_at", { ascending: false });

      if (options?.search) {
        query = query.or(`quote_number.ilike.%${options.search}%,title.ilike.%${options.search}%`);
      }

      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as QuoteWithCustomer[];
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ["quote", id],
    queryFn: async () => {
      if (!id) throw new Error("Quote ID is required");

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select(`
          *,
          customer:customers(*)
        `)
        .eq("id", id)
        .maybeSingle();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error("Quote not found");

      const { data: items, error: itemsError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order", { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...quote,
        quote_items: items || [],
      } as QuoteWithDetails;
    },
    enabled: !!id,
  });
}

interface CreateQuoteInput {
  quote: Omit<TablesInsert<"quotes">, "quote_number">;
  items: Omit<TablesInsert<"quote_items">, "quote_id">[];
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quote, items }: CreateQuoteInput) => {
      // Generate quote number
      const { data: existingQuotes } = await supabase
        .from("quotes")
        .select("quote_number")
        .eq("business_id", quote.business_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastNumber = existingQuotes[0].quote_number;
        const match = lastNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const quoteNumber = `QUO-${String(nextNumber).padStart(4, "0")}`;

      // Create quote
      const { data: newQuote, error: quoteError } = await supabase
        .from("quotes")
        .insert({ ...quote, quote_number: quoteNumber })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Create line items
      if (items.length > 0) {
        const itemsWithQuoteId = items.map((item, index) => ({
          ...item,
          quote_id: newQuote.id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(itemsWithQuoteId);

        if (itemsError) throw itemsError;
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

interface UpdateQuoteInput {
  id: string;
  quote: TablesUpdate<"quotes">;
  items: Omit<TablesInsert<"quote_items">, "quote_id">[];
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, quote, items }: UpdateQuoteInput) => {
      // Update quote
      const { data: updatedQuote, error: quoteError } = await supabase
        .from("quotes")
        .update(quote)
        .eq("id", id)
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Delete existing items and insert new ones
      const { error: deleteError } = await supabase
        .from("quote_items")
        .delete()
        .eq("quote_id", id);

      if (deleteError) throw deleteError;

      if (items.length > 0) {
        const itemsWithQuoteId = items.map((item, index) => ({
          ...item,
          quote_id: id,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(itemsWithQuoteId);

        if (itemsError) throw itemsError;
      }

      return updatedQuote;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Items will cascade delete due to FK constraint
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}

export interface SendQuoteResult {
  success: boolean;
  email_sent: boolean;
  reason?: string;
  email_id?: string;
}

export function useSendQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<SendQuoteResult> => {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quote_id: id },
      });

      if (error) {
        // Fallback: just update the status locally if edge function fails
        console.error('Email send failed, marking as sent:', error);
        await supabase
          .from("quotes")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", id);
        
        return { success: true, email_sent: false, reason: error.message };
      }

      return data as SendQuoteResult;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quote", id] });
    },
  });
}

export function useDuplicateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch original quote with items
      const { data: original, error: fetchError } = await supabase
        .from("quotes")
        .select(`*, quote_items(*)`)
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;
      if (!original) throw new Error("Quote not found");

      // Get next quote number
      const { data: existingQuotes } = await supabase
        .from("quotes")
        .select("quote_number")
        .eq("business_id", original.business_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastNumber = existingQuotes[0].quote_number;
        const match = lastNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const quoteNumber = `QUO-${String(nextNumber).padStart(4, "0")}`;

      // Create duplicate quote
      const { data: newQuote, error: createError } = await supabase
        .from("quotes")
        .insert({
          business_id: original.business_id,
          customer_id: original.customer_id,
          quote_number: quoteNumber,
          title: original.title ? `${original.title} (Copy)` : null,
          status: "draft",
          notes: original.notes,
          internal_notes: original.internal_notes,
          subtotal: original.subtotal,
          tax_rate: original.tax_rate,
          tax_amount: original.tax_amount,
          discount_amount: original.discount_amount,
          total: original.total,
          valid_until: null,
          sent_at: null,
          approved_at: null,
          approved_by: null,
          signature_url: null,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate line items
      if (original.quote_items && original.quote_items.length > 0) {
        const newItems = original.quote_items.map((item: QuoteItem, index: number) => ({
          quote_id: newQuote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(newItems);

        if (itemsError) throw itemsError;
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
