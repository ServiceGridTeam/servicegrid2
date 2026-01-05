import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useCallback } from "react";
import { GOOGLE_MAPS_API_KEY } from "@/config/google-maps";

interface BackendVerificationResult {
  configured: boolean;
  working: boolean;
  error?: string;
  errorCode?: string;
  apisTestedSuccessfully?: string[];
}

interface FrontendVerificationResult {
  configured: boolean;
  keyValue?: string;
  tested: boolean;
  working?: boolean;
  error?: string;
}

interface FullVerificationResult {
  frontend: FrontendVerificationResult;
  backend: BackendVerificationResult | null;
  backendError?: string;
}

export function useVerifyFrontendKey(): FrontendVerificationResult {
  const key: string = GOOGLE_MAPS_API_KEY;
  const isConfigured = Boolean(key && key !== "YOUR_API_KEY_HERE");
  
  return {
    configured: isConfigured,
    keyValue: isConfigured ? `${key.slice(0, 8)}...${key.slice(-4)}` : undefined,
    tested: false,
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
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Test if Google Maps JavaScript API actually loads and works
export function useFrontendMapTest() {
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    working?: boolean;
    error?: string;
  }>({ tested: false });
  const [isTesting, setIsTesting] = useState(false);

  const testFrontendMap = useCallback(async (): Promise<boolean> => {
    const apiKey = GOOGLE_MAPS_API_KEY;
    const isPlaceholder = !apiKey || apiKey.includes("YOUR_API_KEY");
    
    if (isPlaceholder) {
      setTestResult({ tested: true, working: false, error: "API key not configured" });
      return false;
    }

    setIsTesting(true);
    
    try {
      // Check if Google Maps is already loaded
      if (window.google?.maps?.Map) {
        setTestResult({ tested: true, working: true });
        setIsTesting(false);
        return true;
      }

      // Try to load the Maps JavaScript API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      
      const loadPromise = new Promise<boolean>((resolve) => {
        script.onload = () => {
          // Verify it actually loaded
          if (window.google?.maps?.Map) {
            setTestResult({ tested: true, working: true });
            resolve(true);
          } else {
            setTestResult({ tested: true, working: false, error: "Maps API failed to initialize" });
            resolve(false);
          }
        };
        
        script.onerror = () => {
          setTestResult({ tested: true, working: false, error: "Failed to load Maps API script" });
          resolve(false);
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!testResult.tested) {
            setTestResult({ tested: true, working: false, error: "Map load timed out" });
            resolve(false);
          }
        }, 10000);
      });

      document.head.appendChild(script);
      const result = await loadPromise;
      setIsTesting(false);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      setTestResult({ tested: true, working: false, error });
      setIsTesting(false);
      return false;
    }
  }, []);

  return {
    testResult,
    isTesting,
    testFrontendMap,
  };
}

export function useFullVerification() {
  const frontendBase = useVerifyFrontendKey();
  const { data: backend, isLoading: isBackendLoading, error, refetch: refetchBackend } = useVerifyBackendKey();
  const { testResult: frontendTestResult, isTesting: isFrontendTesting, testFrontendMap } = useFrontendMapTest();
  
  const frontend: FrontendVerificationResult = {
    ...frontendBase,
    tested: frontendTestResult.tested,
    working: frontendTestResult.working,
    error: frontendTestResult.error,
  };
  
  const result: FullVerificationResult = {
    frontend,
    backend: backend ?? null,
    backendError: error?.message,
  };
  
  const refetch = useCallback(async () => {
    // Test both frontend and backend
    await Promise.all([
      testFrontendMap(),
      refetchBackend(),
    ]);
  }, [testFrontendMap, refetchBackend]);
  
  return {
    result,
    isLoading: isBackendLoading || isFrontendTesting,
    refetch,
    testFrontendMap,
  };
}

// Extend window type for Google Maps
declare global {
  interface Window {
    google?: {
      maps?: {
        Map?: unknown;
      };
    };
  }
}
