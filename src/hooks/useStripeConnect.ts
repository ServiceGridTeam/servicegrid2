import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StripeConnectStatus {
  status: "not_started" | "pending" | "restricted" | "complete";
  onboarding_complete: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

interface OnboardResponse {
  url: string;
  account_id: string;
}

export function useStripeConnectStatus() {
  return useQuery<StripeConnectStatus>({
    queryKey: ["stripe-connect-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status");
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data as StripeConnectStatus;
    },
    staleTime: 1000 * 60, // 1 minute
    retry: false,
  });
}

export function useStripeConnectOnboard() {
  const queryClient = useQueryClient();

  return useMutation<OnboardResponse, Error, { return_url: string }>({
    mutationFn: async ({ return_url }) => {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { return_url },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as OnboardResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
      queryClient.invalidateQueries({ queryKey: ["business"] });
    },
  });
}
