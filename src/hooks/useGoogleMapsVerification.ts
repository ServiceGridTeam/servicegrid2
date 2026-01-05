import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BackendVerificationResult {
  configured: boolean;
  working: boolean;
  error?: string;
  errorCode?: string;
  apisTestedSuccessfully?: string[];
}

interface FrontendVerificationResult {
  configured: boolean;
  keyValue?: string; // Partial key for display
}

interface FullVerificationResult {
  frontend: FrontendVerificationResult;
  backend: BackendVerificationResult | null;
  backendError?: string;
}

export function useVerifyFrontendKey(): FrontendVerificationResult {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  return {
    configured: !!key,
    keyValue: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : undefined,
  };
}

export function useVerifyBackendKey(enabled: boolean = true) {
  return useQuery({
    queryKey: ["google-maps-verification"],
    queryFn: async (): Promise<BackendVerificationResult> => {
      console.log("useVerifyBackendKey: Invoking verify-google-maps function");
      
      const { data, error } = await supabase.functions.invoke("verify-google-maps");
      
      if (error) {
        console.error("useVerifyBackendKey: Function invocation error:", error);
        throw new Error(error.message || "Failed to verify backend API key");
      }
      
      console.log("useVerifyBackendKey: Result:", data);
      return data as BackendVerificationResult;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry verification failures
  });
}

export function useFullVerification() {
  const frontend = useVerifyFrontendKey();
  const { data: backend, isLoading, error, refetch } = useVerifyBackendKey();
  
  const result: FullVerificationResult = {
    frontend,
    backend: backend ?? null,
    backendError: error?.message,
  };
  
  return {
    result,
    isLoading,
    refetch,
  };
}
