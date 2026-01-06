import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SendInviteParams {
  customerId: string;
  businessId: string;
  email?: string;
  customerName?: string;
}

interface SendInviteResult {
  success: boolean;
  error?: string;
  email?: string;
}

export function useSendPortalInvite() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendInvite = async (params: SendInviteParams): Promise<SendInviteResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("portal-auth", {
        body: {
          action: "send-invite",
          customerId: params.customerId,
          businessId: params.businessId,
          email: params.email,
          customerName: params.customerName,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return { success: true, email: data?.email };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invite";
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendInvite,
    isLoading,
    error,
  };
}
