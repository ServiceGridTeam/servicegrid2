import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  isTracking: boolean;
}

interface UseLocationTrackingOptions {
  intervalMs?: number; // How often to send updates (default: 30000 = 30 seconds)
  enableHighAccuracy?: boolean;
  autoStart?: boolean;
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const { intervalMs = 30000, enableHighAccuracy = true, autoStart = false } = options;
  const { data: profile } = useProfile();

  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    isTracking: false,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isTrackingRef = useRef<boolean>(false);

  const sendLocationUpdate = useCallback(
    async (position: GeolocationPosition) => {
      if (!profile?.business_id) return;

      const now = Date.now();
      // Rate limit: only send updates at the specified interval
      if (now - lastUpdateRef.current < intervalMs) {
        return;
      }
      lastUpdateRef.current = now;

      try {
        const { error } = await supabase.functions.invoke("worker-location-update", {
          body: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          },
        });

        if (error) {
          console.error("Failed to send location update:", error);
        }
      } catch (err) {
        console.error("Location update error:", err);
      }
    },
    [profile?.business_id, intervalMs]
  );

  const handlePositionUpdate = useCallback(
    (position: GeolocationPosition) => {
      setState((prev) => ({
        ...prev,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        timestamp: position.timestamp,
        error: null,
      }));

      sendLocationUpdate(position);
    },
    [sendLocationUpdate]
  );

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Location permission denied";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location unavailable";
        break;
      case error.TIMEOUT:
        errorMessage = "Location request timed out";
        break;
      default:
        errorMessage = "Unknown location error";
    }

    setState((prev) => ({
      ...prev,
      error: errorMessage,
    }));
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation not supported",
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    isTrackingRef.current = true;
    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy,
        timeout: 30000,
        maximumAge: 10000,
      }
    );
  }, [handlePositionUpdate, handlePositionError, enableHighAccuracy]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    isTrackingRef.current = false;
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && profile?.business_id) {
      startTracking();
    }

    return () => {
      stopTracking();
    };
  }, [autoStart, profile?.business_id, startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    isSupported: !!navigator.geolocation,
  };
}
