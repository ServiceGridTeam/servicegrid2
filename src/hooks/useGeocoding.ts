import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GeocodeCache, AddressWithCoordinates } from "@/types/routePlanning";

// Check cache first, then geocode via edge function
export function useGeocodeAddress(address: string | undefined) {
  return useQuery({
    queryKey: ["geocode", address],
    queryFn: async () => {
      if (!address || address.trim().length < 5) return null;

      const normalizedAddress = address.trim().toLowerCase();

      // Check cache first
      const { data: cached } = await supabase
        .from("geocode_cache")
        .select("*")
        .eq("address", normalizedAddress)
        .maybeSingle();

      if (cached) {
        return {
          address: normalizedAddress,
          latitude: cached.latitude,
          longitude: cached.longitude,
          formattedAddress: cached.formatted_address || undefined,
          placeId: cached.place_id || undefined,
        } as AddressWithCoordinates;
      }

      // If not cached, call the geocode-address edge function
      const { data, error } = await supabase.functions.invoke("geocode-address", {
        body: { address: normalizedAddress },
      });

      if (error) {
        console.error("Geocoding error:", error);
        return null;
      }

      if (data && data.latitude && data.longitude) {
        return {
          address: normalizedAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          formattedAddress: data.formattedAddress,
          placeId: data.placeId,
        } as AddressWithCoordinates;
      }

      return null;
    },
    enabled: !!address && address.trim().length >= 5,
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
  });
}

// Batch geocode multiple addresses
export function useBatchGeocodeAddresses(addresses: string[]) {
  return useQuery({
    queryKey: ["geocode-batch", addresses],
    queryFn: async () => {
      if (addresses.length === 0) return [];

      const normalizedAddresses = addresses.map((a) => a.trim().toLowerCase());

      // Check cache for all addresses
      const { data: cached } = await supabase
        .from("geocode_cache")
        .select("*")
        .in("address", normalizedAddresses);

      const results: AddressWithCoordinates[] = [];
      const uncached: string[] = [];

      for (const address of normalizedAddresses) {
        const hit = cached?.find((c) => c.address === address);
        if (hit) {
          results.push({
            address,
            latitude: hit.latitude,
            longitude: hit.longitude,
            formattedAddress: hit.formatted_address || undefined,
            placeId: hit.place_id || undefined,
          });
        } else {
          uncached.push(address);
        }
      }

      // Geocode uncached addresses via edge function
      if (uncached.length > 0) {
        const { data, error } = await supabase.functions.invoke("geocode-address", {
          body: { addresses: uncached },
        });

        if (!error && data?.results) {
          for (const geocoded of data.results) {
            results.push({
              address: geocoded.address,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
              formattedAddress: geocoded.formattedAddress,
              placeId: geocoded.placeId,
            });
          }
        }
      }

      return results;
    },
    enabled: addresses.length > 0,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

// Store geocode result in cache
export function useCacheGeocode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (result: AddressWithCoordinates) => {
      const { data, error } = await supabase
        .from("geocode_cache")
        .upsert(
          {
            address: result.address.trim().toLowerCase(),
            latitude: result.latitude,
            longitude: result.longitude,
            formatted_address: result.formattedAddress,
            place_id: result.placeId,
          },
          { onConflict: "address" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["geocode", data.address] });
      queryClient.invalidateQueries({ queryKey: ["geocode-batch"] });
    },
  });
}

// Get cached coordinates for a job or customer address
export function useCachedCoordinates(addressComponents: {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const fullAddress = [
    addressComponents.addressLine1,
    addressComponents.city,
    addressComponents.state,
    addressComponents.zip,
  ]
    .filter(Boolean)
    .join(", ");

  return useGeocodeAddress(fullAddress || undefined);
}

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Estimate drive time based on distance (rough approximation)
// Uses average speed of 40 km/h for urban areas
export function estimateDriveTime(distanceMeters: number): number {
  const averageSpeedKmh = 40;
  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / averageSpeedKmh;
  return Math.round(hours * 60); // Return minutes
}
