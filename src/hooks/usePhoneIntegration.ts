import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { generateApiKey, getKeyPrefix, hashApiKey } from "@/lib/api-key";
import { toast } from "sonner";

export interface PhoneIntegrationPermissions {
  lookup_customer: boolean;
  read_jobs: boolean;
  create_requests: boolean;
  modify_jobs: boolean;
  read_pricing: boolean;
  read_technician_eta: boolean;
}

export interface PhoneIntegration {
  id: string;
  business_id: string;
  api_key_prefix: string;
  permissions: PhoneIntegrationPermissions;
  status: 'active' | 'revoked';
  last_used_at: string | null;
  request_count: number;
  request_count_reset_at: string | null;
  name: string;
  created_at: string;
  created_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

/**
 * Fetch the current business's phone integration
 */
export function usePhoneIntegration() {
  const { data: profile } = useProfile();

  return useQuery({
    queryKey: ["phone-integration", profile?.business_id],
    queryFn: async () => {
      if (!profile?.business_id) return null;

      const { data, error } = await supabase
        .from("phone_integrations")
        .select("*")
        .eq("business_id", profile.business_id)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        status: data.status as 'active' | 'revoked',
        permissions: data.permissions as unknown as PhoneIntegrationPermissions,
      } as PhoneIntegration;
    },
    enabled: !!profile?.business_id,
  });
}

/**
 * Generate a new API key for the business
 * Returns the full API key ONCE - it cannot be retrieved again
 */
export function useGenerateApiKey() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!profile?.business_id) throw new Error("No business found");

      // Generate the API key
      const fullKey = generateApiKey();
      const keyHash = await hashApiKey(fullKey);
      const keyPrefix = getKeyPrefix(fullKey);

      // Check if there's an existing active integration
      const { data: existing } = await supabase
        .from("phone_integrations")
        .select("id")
        .eq("business_id", profile.business_id)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        // Revoke the old one first
        await supabase
          .from("phone_integrations")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: profile.id,
          })
          .eq("id", existing.id);
      }

      // Create new integration
      const { error } = await supabase
        .from("phone_integrations")
        .insert({
          business_id: profile.business_id,
          api_key_hash: keyHash,
          api_key_prefix: keyPrefix,
          created_by: profile.id,
        });

      if (error) throw error;

      return fullKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-integration"] });
      toast.success("API key generated successfully");
    },
    onError: (error) => {
      console.error("Failed to generate API key:", error);
      toast.error("Failed to generate API key");
    },
  });
}

/**
 * Revoke the current API key
 */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      if (!profile?.id) throw new Error("No user found");

      const { error } = await supabase
        .from("phone_integrations")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: profile.id,
        })
        .eq("id", integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-integration"] });
      toast.success("API key revoked successfully");
    },
    onError: (error) => {
      console.error("Failed to revoke API key:", error);
      toast.error("Failed to revoke API key");
    },
  });
}

/**
 * Update phone integration permissions
 */
export function useUpdatePhonePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      integrationId,
      permissions,
    }: {
      integrationId: string;
      permissions: Partial<PhoneIntegrationPermissions>;
    }) => {
      // Get current permissions first
      const { data: current, error: fetchError } = await supabase
        .from("phone_integrations")
        .select("permissions")
        .eq("id", integrationId)
        .single();

      if (fetchError) throw fetchError;

      // Merge permissions
      const updatedPermissions = {
        ...(current.permissions as unknown as PhoneIntegrationPermissions),
        ...permissions,
      };

      const { error } = await supabase
        .from("phone_integrations")
        .update({ permissions: updatedPermissions })
        .eq("id", integrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phone-integration"] });
      toast.success("Permissions updated");
    },
    onError: (error) => {
      console.error("Failed to update permissions:", error);
      toast.error("Failed to update permissions");
    },
  });
}
