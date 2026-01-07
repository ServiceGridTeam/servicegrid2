import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessContext } from "./useBusinessContext";
import { toast } from "sonner";

export interface EmailConnection {
  id: string;
  business_id: string;
  provider: "gmail" | "outlook";
  email_address: string;
  poll_interval_seconds: number;
  last_sync_at: string | null;
  classification_threshold: number;
  auto_create_requests: boolean;
  auto_acknowledge: boolean;
  connection_health: "healthy" | "warning" | "error";
  sync_errors_count: number;
  last_error_message: string | null;
  last_error_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmailConnections() {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ["email-connections", businessId],
    queryFn: async () => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from("email_connections")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailConnection[];
    },
    enabled: !!businessId,
  });
}

export function useEmailConnection(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["email-connection", connectionId],
    queryFn: async () => {
      if (!connectionId) return null;

      const { data, error } = await supabase
        .from("email_connections")
        .select("*")
        .eq("id", connectionId)
        .single();

      if (error) throw error;
      return data as EmailConnection;
    },
    enabled: !!connectionId,
  });
}

export function useConnectGmail() {
  const queryClient = useQueryClient();
  const { activeBusinessId } = useBusinessContext();

  return useMutation({
    mutationFn: async (params: { code: string; redirectUri: string }) => {
      if (!activeBusinessId) {
        throw new Error("No active business");
      }

      const { data, error } = await supabase.functions.invoke("email-oauth-callback", {
        body: {
          code: params.code,
          business_id: activeBusinessId,
          redirect_uri: params.redirectUri,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast.success("Gmail connected successfully!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect Gmail: ${error.message}`);
    },
  });
}

export function useUpdateEmailConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      connectionId: string;
      updates: Partial<Pick<EmailConnection, 
        "classification_threshold" | 
        "auto_create_requests" | 
        "auto_acknowledge" | 
        "is_active" |
        "poll_interval_seconds"
      >>;
    }) => {
      const { data, error } = await supabase
        .from("email_connections")
        .update({
          ...params.updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.connectionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      queryClient.invalidateQueries({ queryKey: ["email-connection", variables.connectionId] });
      toast.success("Settings updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
}

export function useDisconnectEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      // Soft delete - mark as inactive
      const { error } = await supabase
        .from("email_connections")
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      toast.success("Email disconnected. Data retained for 30 days.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });
}

export function useTriggerEmailSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId?: string) => {
      const { data, error } = await supabase.functions.invoke("email-sync", {
        body: connectionId ? { connection_id: connectionId } : {},
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-connections"] });
      queryClient.invalidateQueries({ queryKey: ["inbound-emails"] });
      toast.success(`Synced ${data.emails_synced} emails`);
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}

// Helper to build Google OAuth URL
export function buildGoogleOAuthUrl(redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
