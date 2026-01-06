import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export interface UseCampaignsOptions {
  status?: CampaignStatus;
  search?: string;
}

export function useCampaigns(options?: UseCampaignsOptions) {
  return useQuery({
    queryKey: ["campaigns", options],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select(`
          *,
          template:email_templates(id, name, subject),
          segment:audience_segments(id, name)
        `)
        .order("created_at", { ascending: false });

      if (options?.status) {
        query = query.eq("status", options.status);
      }

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,subject.ilike.%${options.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", id],
    queryFn: async () => {
      if (!id || id === "new") return null;

      const { data, error } = await supabase
        .from("campaigns")
        .select(`
          *,
          template:email_templates(id, name, subject, body_html),
          segment:audience_segments(id, name, filter_config)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && id !== "new",
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Omit<CampaignInsert, "business_id">) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .single();

      if (!profile?.business_id) throw new Error("No business found");

      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          ...campaign,
          business_id: profile.business_id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CampaignUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", data.id] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useDuplicateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          ...original,
          id: undefined,
          name: `${original.name} (Copy)`,
          status: "draft",
          scheduled_at: null,
          sent_at: null,
          sent_count: 0,
          delivered_count: 0,
          opened_count: 0,
          clicked_count: 0,
          bounced_count: 0,
          complained_count: 0,
          unsubscribed_count: 0,
          total_recipients: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useScheduleCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: Date }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update({
          status: "scheduled",
          scheduled_at: scheduledAt.toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", data.id] });
    },
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First update status to sending
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ status: "sending" })
        .eq("id", id);

      if (updateError) throw updateError;

      // Trigger the edge function
      const { data, error } = await supabase.functions.invoke("send-campaign-emails", {
        body: { campaign_id: id },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update({
          status: "cancelled",
          scheduled_at: null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", data.id] });
    },
  });
}

export function useCampaignEmailSends(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaign-email-sends", campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      const { data, error } = await supabase
        .from("email_sends")
        .select(`
          *,
          customer:customers(id, first_name, last_name, email)
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });
}
