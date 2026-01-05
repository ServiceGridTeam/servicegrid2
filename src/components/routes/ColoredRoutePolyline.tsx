import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

interface ColoredRoutePolylineProps {
  encodedPath: string;
  color: string;
  strokeWeight?: number;
  visible?: boolean;
}

// Decode Google Maps encoded polyline
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export function ColoredRoutePolyline({
  encodedPath,
  color,
  strokeWeight = 4,
  visible = true,
}: ColoredRoutePolylineProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || !encodedPath || !visible) return;

    const path = decodePolyline(encodedPath);
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: 0.85,
      strokeWeight,
      map,
    });

    return () => polyline.setMap(null);
  }, [map, encodedPath, color, strokeWeight, visible]);

  return null;
}
