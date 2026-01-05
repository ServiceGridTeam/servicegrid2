import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeofenceValidationResult {
  allowed: boolean;
  within_geofence: boolean;
  distance_meters: number;
  distance_feet: number;
  geofence_radius_meters: number;
  enforcement_mode: "off" | "warn" | "strict";
  can_override: boolean;
  override_requires_reason: boolean;
  override_requires_photo: boolean;
  message: string;
  clock_event_id?: string;
}

export interface ValidateClockInParams {
  jobId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  locationSource?: "gps" | "network" | "manual";
  eventType: "clock_in" | "clock_out";
}

export interface ClockInOverrideParams {
  jobId: string;
  location: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  reason: string;
  photoBase64?: string;
  eventType: "clock_in" | "clock_out";
}

export function useValidateClockIn() {
  return useMutation({
    mutationFn: async (params: ValidateClockInParams): Promise<GeofenceValidationResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("validate-clock-in", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
  });
}

export function useClockInWithOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ClockInOverrideParams) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("clock-in-with-override", {
        body: params,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["geofence-alerts"] });
    },
  });
}
