import { supabase } from "@/integrations/supabase/client";

export async function geocodeJobAddress(
  jobId: string,
  address: {
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  }
): Promise<{ latitude: number; longitude: number } | null> {
  const fullAddress = [address.address_line1, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(", ");

  if (!fullAddress || fullAddress.length < 5) {
    console.log("geocodeJobAddress: Address too short to geocode:", fullAddress);
    return null;
  }

  try {
    console.log("geocodeJobAddress: Geocoding address:", fullAddress);
    
    const { data, error } = await supabase.functions.invoke("geocode-address", {
      body: { address: fullAddress },
    });

    if (error) {
      console.error("geocodeJobAddress: Edge function error:", error);
      throw error;
    }

    if (data?.latitude && data?.longitude) {
      console.log("geocodeJobAddress: Got coordinates:", data.latitude, data.longitude);
      
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          latitude: data.latitude,
          longitude: data.longitude,
        })
        .eq("id", jobId);

      if (updateError) {
        console.error("geocodeJobAddress: Failed to update job:", updateError);
      }

      return { latitude: data.latitude, longitude: data.longitude };
    }

    console.log("geocodeJobAddress: No coordinates returned from geocoding");
    return null;
  } catch (err) {
    console.error("geocodeJobAddress: Geocoding failed for job:", jobId, err);
    return null;
  }
}
