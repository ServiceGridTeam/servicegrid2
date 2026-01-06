import { useMemo } from "react";
import { Marker } from "@vis.gl/react-google-maps";
import { Clock } from "lucide-react";

interface TravelSegmentLabelProps {
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  durationMinutes: number;
  color?: string;
}

export function TravelSegmentLabel({
  startPoint,
  endPoint,
  durationMinutes,
  color = "#3b82f6",
}: TravelSegmentLabelProps) {
  // Calculate midpoint of the segment
  const midpoint = useMemo(() => ({
    lat: (startPoint.lat + endPoint.lat) / 2,
    lng: (startPoint.lng + endPoint.lng) / 2,
  }), [startPoint, endPoint]);

  // Format duration
  const durationLabel = useMemo(() => {
    if (durationMinutes < 60) {
      return `${Math.round(durationMinutes)} min`;
    }
    const hours = Math.floor(durationMinutes / 60);
    const mins = Math.round(durationMinutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, [durationMinutes]);

  // Only show if duration is meaningful (> 1 minute)
  if (durationMinutes < 1) return null;

  return (
    <Marker
      position={midpoint}
      clickable={false}
      icon={{
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0, // Invisible marker, just used for positioning
      }}
      label={{
        text: durationLabel,
        className: "travel-segment-label",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: "600",
      }}
    />
  );
}

// CSS for travel segment labels (should be added to index.css or a relevant stylesheet)
// .travel-segment-label {
//   background-color: rgba(59, 130, 246, 0.9);
//   padding: 2px 6px;
//   border-radius: 4px;
//   box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
// }
