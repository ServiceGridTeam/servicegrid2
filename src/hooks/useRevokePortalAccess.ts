import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface RevokeResult {
  success: boolean;
  error?: string;
}

export function useRevokePortalAccess() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const revokeAccess = async (
    customerId: string,
    businessId: string
  ): Promise<RevokeResult> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-auth", {
        body: {
          action: "revoke-access",
          customerId,
          businessId,
        },
      });

      if (error) {
        console.error("[useRevokePortalAccess] Error:", error);
        return { success: false, error: error.message };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["customer-portal-status"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portal-status-single", customerId] });
      queryClient.invalidateQueries({ queryKey: ["portal-invite-history", customerId] });

      return { success: true };
    } catch (err) {
      console.error("[useRevokePortalAccess] Exception:", err);
      return { success: false, error: "Failed to revoke access" };
    } finally {
      setIsLoading(false);
    }
  };

  return { revokeAccess, isLoading };
}
