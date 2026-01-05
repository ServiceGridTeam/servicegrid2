import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GeoLocation, DailyRoutePlan } from "@/types/routePlanning";
import type { Json } from "@/integrations/supabase/types";

interface OptimizeRouteInput {
  userId: string;
  date: string; // YYYY-MM-DD
  startLocation?: GeoLocation;
  endLocation?: GeoLocation;
}

interface OptimizeRouteResult {
  routePlanId: string;
  optimizedJobIds: string[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  legs: RouteLeg[];
  overviewPolyline: string | null;
}

export interface RouteLeg {
  from: string;
  to: string;
  distanceMeters: number;
  durationSeconds: number;
}

export function useOptimizeRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OptimizeRouteInput): Promise<OptimizeRouteResult> => {
      const { data, error } = await supabase.functions.invoke("optimize-job-route", {
        body: {
          userId: input.userId,
          date: input.date,
          startLocation: input.startLocation
            ? { lat: input.startLocation.latitude, lng: input.startLocation.longitude }
            : undefined,
          endLocation: input.endLocation
            ? { lat: input.endLocation.latitude, lng: input.endLocation.longitude }
            : undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["daily-route-plans"] });
      queryClient.invalidateQueries({ queryKey: ["daily-route-plan", variables.userId, variables.date] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useDailyRoutePlan(userId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ["daily-route-plan", userId, date],
    queryFn: async () => {
      if (!userId || !date) return null;

      const { data, error } = await supabase
        .from("daily_route_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("route_date", date)
        .maybeSingle();

      if (error) throw error;
      return data as DailyRoutePlan | null;
    },
    enabled: !!userId && !!date,
  });
}

// Parse legs from the JSON stored in daily_route_plans
export function parseRouteLegs(legs: unknown): RouteLeg[] {
  if (!legs || !Array.isArray(legs)) return [];
  return legs.map((leg) => ({
    from: String((leg as Record<string, unknown>).from || ""),
    to: String((leg as Record<string, unknown>).to || ""),
    distanceMeters: Number((leg as Record<string, unknown>).distanceMeters || 0),
    durationSeconds: Number((leg as Record<string, unknown>).durationSeconds || 0),
  }));
}

// Format distance for display
export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) {
    return `${Math.round(meters)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

// Format duration for display
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours}h ${minutes}m`;
}
