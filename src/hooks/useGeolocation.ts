import { useState, useCallback, useEffect } from "react";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  timestamp: number | null;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const defaultOptions: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export function useGeolocation(options: GeolocationOptions = defaultOptions) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    timestamp: null,
  });

  const getCurrentPosition = useCallback((): Promise<GeolocationState> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const errorState = {
          latitude: null,
          longitude: null,
          accuracy: null,
          error: "Geolocation is not supported by your browser",
          loading: false,
          timestamp: null,
        };
        setState(errorState);
        resolve(errorState);
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const successState = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            error: null,
            loading: false,
            timestamp: position.timestamp,
          };
          setState(successState);
          resolve(successState);
        },
        (error) => {
          let errorMessage: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access was denied. Please enable location permissions.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again.";
              break;
            default:
              errorMessage = "An unknown error occurred getting your location.";
          }
          const errorState = {
            latitude: null,
            longitude: null,
            accuracy: null,
            error: errorMessage,
            loading: false,
            timestamp: null,
          };
          setState(errorState);
          resolve(errorState);
        },
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 15000,
          maximumAge: options.maximumAge ?? 0,
        }
      );
    });
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    getCurrentPosition,
    clearError,
  };
}

// Hook to get accuracy level for UI display
export function useLocationAccuracyLevel(accuracy: number | null): {
  level: "high" | "medium" | "low" | "none";
  bars: number;
  color: string;
  label: string;
} {
  if (accuracy === null) {
    return { level: "none", bars: 0, color: "text-muted-foreground", label: "No signal" };
  }
  if (accuracy <= 10) {
    return { level: "high", bars: 3, color: "text-green-500", label: "High accuracy" };
  }
  if (accuracy <= 50) {
    return { level: "medium", bars: 2, color: "text-yellow-500", label: "Medium accuracy" };
  }
  return { level: "low", bars: 1, color: "text-red-500", label: "Low accuracy" };
}
