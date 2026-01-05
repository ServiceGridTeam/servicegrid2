import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  address?: string;
  addresses?: string[];
}

interface GeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  placeId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleMapsApiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!googleMapsApiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: GeocodeRequest = await req.json();

    // Handle single address or batch
    const addressesToGeocode = body.addresses || (body.address ? [body.address] : []);

    if (addressesToGeocode.length === 0) {
      return new Response(
        JSON.stringify({ error: "No addresses provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Geocoding ${addressesToGeocode.length} addresses`);

    const results: GeocodeResult[] = [];
    const errors: { address: string; error: string }[] = [];

    // Check cache first for all addresses
    const normalizedAddresses = addressesToGeocode.map((a) => a.trim().toLowerCase());
    const { data: cached } = await supabase
      .from("geocode_cache")
      .select("*")
      .in("address", normalizedAddresses);

    const cachedMap = new Map(cached?.map((c) => [c.address, c]) || []);
    const uncachedAddresses = normalizedAddresses.filter((a) => !cachedMap.has(a));

    // Add cached results
    for (const [address, cache] of cachedMap.entries()) {
      results.push({
        address,
        latitude: cache.latitude,
        longitude: cache.longitude,
        formattedAddress: cache.formatted_address || undefined,
        placeId: cache.place_id || undefined,
      });
    }

    console.log(`Found ${cached?.length || 0} cached, need to geocode ${uncachedAddresses.length}`);

    // Geocode uncached addresses
    for (const address of uncachedAddresses) {
      try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleMapsApiKey}`;
        const response = await fetch(geocodeUrl);
        const data = await response.json();

        if (data.status === "OK" && data.results.length > 0) {
          const result = data.results[0];
          const location = result.geometry.location;

          const geocodeResult: GeocodeResult = {
            address,
            latitude: location.lat,
            longitude: location.lng,
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
          };

          results.push(geocodeResult);

          // Cache the result
          await supabase.from("geocode_cache").upsert(
            {
              address,
              latitude: location.lat,
              longitude: location.lng,
              formatted_address: result.formatted_address,
              place_id: result.place_id,
            },
            { onConflict: "address" }
          );

          console.log(`Geocoded and cached: ${address}`);
        } else {
          console.warn(`Geocoding failed for "${address}": ${data.status}`);
          errors.push({ address, error: data.status });
        }

        // Rate limiting: small delay between requests
        if (uncachedAddresses.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error geocoding "${address}":`, error);
        errors.push({ address, error: errMsg });
      }
    }

    // If single address was requested, return single result
    if (body.address && !body.addresses) {
      const singleAddress = body.address.trim().toLowerCase();
      const result = results.find((r) => r.address === singleAddress);
      if (result) {
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const err = errors.find((e) => e.address === singleAddress);
        return new Response(
          JSON.stringify({ error: err?.error || "Geocoding failed" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Return batch results
    return new Response(
      JSON.stringify({
        results,
        errors: errors.length > 0 ? errors : undefined,
        cached: cached?.length || 0,
        geocoded: uncachedAddresses.length - errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to geocode address";
    console.error("Error in geocode-address:", error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
