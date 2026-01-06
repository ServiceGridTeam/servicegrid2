import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailPreferences {
  id: string;
  customer_id: string;
  business_id: string;
  subscribed_marketing: boolean;
  subscribed_transactional: boolean;
  subscribed_sequences: boolean;
  unsubscribed_at: string | null;
  unsubscribe_reason: string | null;
  preference_token: string;
  customer?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  business?: {
    name: string;
    logo_url: string | null;
  };
}

export function usePublicEmailPreferences(token: string | undefined) {
  return useQuery({
    queryKey: ["email-preferences", token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase
        .from("email_preferences")
        .select(`
          *,
          customer:customers(first_name, last_name, email),
          business:businesses(name, logo_url)
        `)
        .eq("preference_token", token)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw error;
      }

      return data as EmailPreferences;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useUpdateEmailPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      preferences,
    }: {
      token: string;
      preferences: {
        subscribed_marketing?: boolean;
        subscribed_sequences?: boolean;
      };
    }) => {
      const { data, error } = await supabase
        .from("email_preferences")
        .update({
          ...preferences,
          updated_at: new Date().toISOString(),
          // If re-subscribing, clear unsubscribe data
          ...(preferences.subscribed_marketing && {
            resubscribed_at: new Date().toISOString(),
          }),
        })
        .eq("preference_token", token)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email-preferences", variables.token] });
      toast.success("Preferences updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update preferences: " + (error as Error).message);
    },
  });
}

export function useUnsubscribeAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      token,
      reason,
    }: {
      token: string;
      reason?: string;
    }) => {
      const now = new Date().toISOString();

      // Update preferences
      const { data, error } = await supabase
        .from("email_preferences")
        .update({
          subscribed_marketing: false,
          subscribed_sequences: false,
          unsubscribed_at: now,
          unsubscribe_reason: reason || "user_request",
          updated_at: now,
        })
        .eq("preference_token", token)
        .select("customer_id")
        .single();

      if (error) throw error;

      // Cancel active sequence enrollments for this customer
      if (data?.customer_id) {
        await supabase
          .from("sequence_enrollments")
          .update({
            status: "unsubscribed",
            unsubscribed_at: now,
          })
          .eq("customer_id", data.customer_id)
          .eq("status", "active");
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email-preferences", variables.token] });
      toast.success("You have been unsubscribed from all marketing emails");
    },
    onError: (error) => {
      toast.error("Failed to unsubscribe: " + (error as Error).message);
    },
  });
}
