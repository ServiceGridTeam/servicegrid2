import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerificationResult {
  configured: boolean;
  working: boolean;
  error?: string;
  errorCode?: string;
  apisTestedSuccessfully?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("verify-google-maps: Starting verification");

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    
    if (!apiKey) {
      console.log("verify-google-maps: API key not configured");
      return new Response(
        JSON.stringify({
          configured: false,
          working: false,
          error: "API key not configured",
        } as VerificationResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("verify-google-maps: API key found, testing Geocoding API");

    // Test with Google HQ address - known to always geocode successfully
    const testAddress = "1600 Amphitheatre Parkway, Mountain View, CA";
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(testAddress)}&key=${apiKey}`;

    const response = await fetch(geocodeUrl);
    const data = await response.json();

    console.log("verify-google-maps: Geocoding API response status:", data.status);

    if (data.status === "OK") {
      console.log("verify-google-maps: Verification successful");
      return new Response(
        JSON.stringify({
          configured: true,
          working: true,
          apisTestedSuccessfully: ["Geocoding API"],
        } as VerificationResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map API error statuses to user-friendly messages
    let errorMessage: string;
    switch (data.status) {
      case "REQUEST_DENIED":
        errorMessage = data.error_message || "API key is invalid or Geocoding API is not enabled";
        break;
      case "OVER_QUERY_LIMIT":
        errorMessage = "API quota exceeded - check your Google Cloud billing";
        break;
      case "OVER_DAILY_LIMIT":
        errorMessage = "Daily quota exceeded - check your Google Cloud billing";
        break;
      case "INVALID_REQUEST":
        errorMessage = "Invalid request - this shouldn't happen with the test address";
        break;
      default:
        errorMessage = `Unexpected API response: ${data.status}`;
    }

    console.log("verify-google-maps: Verification failed:", errorMessage);

    return new Response(
      JSON.stringify({
        configured: true,
        working: false,
        error: errorMessage,
        errorCode: data.status,
      } as VerificationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("verify-google-maps: Exception during verification:", error);
    return new Response(
      JSON.stringify({
        configured: true,
        working: false,
        error: `Network error: ${errorMessage}`,
      } as VerificationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
