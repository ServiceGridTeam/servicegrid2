import { MapPin, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GPSAccuracyIndicatorProps {
  accuracy: number | null;
  latitude?: number | null;
  longitude?: number | null;
  className?: string;
  showLabel?: boolean;
}

type AccuracyLevel = "high" | "medium" | "low" | "unavailable";

function getAccuracyLevel(accuracy: number | null): AccuracyLevel {
  if (accuracy === null || accuracy === undefined) return "unavailable";
  if (accuracy < 10) return "high";
  if (accuracy <= 50) return "medium";
  return "low";
}

function getAccuracyColor(level: AccuracyLevel): string {
  switch (level) {
    case "high":
      return "text-green-600 dark:text-green-400";
    case "medium":
      return "text-yellow-600 dark:text-yellow-400";
    case "low":
      return "text-red-600 dark:text-red-400";
    case "unavailable":
      return "text-muted-foreground";
  }
}

function getAccuracyLabel(level: AccuracyLevel, accuracy: number | null): string {
  switch (level) {
    case "high":
      return `High accuracy (±${Math.round(accuracy!)}m)`;
    case "medium":
      return `Medium accuracy (±${Math.round(accuracy!)}m)`;
    case "low":
      return `Low accuracy (±${Math.round(accuracy!)}m)`;
    case "unavailable":
      return "GPS unavailable";
  }
}

function getShortLabel(level: AccuracyLevel, accuracy: number | null): string {
  if (level === "unavailable") return "No GPS";
  return `±${Math.round(accuracy!)}m`;
}

export function GPSAccuracyIndicator({
  accuracy,
  latitude,
  longitude,
  className,
  showLabel = false,
}: GPSAccuracyIndicatorProps) {
  const level = getAccuracyLevel(accuracy);
  const colorClass = getAccuracyColor(level);
  const label = getAccuracyLabel(level, accuracy);
  const hasCoordinates = latitude !== null && latitude !== undefined && 
                         longitude !== null && longitude !== undefined;

  const Icon = level === "unavailable" ? MapPinOff : MapPin;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1", className)}>
            <Icon className={cn("h-4 w-4", colorClass)} />
            {showLabel && (
              <span className={cn("text-xs", colorClass)}>
                {getShortLabel(level, accuracy)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-medium">{label}</p>
            {hasCoordinates && (
              <p className="text-muted-foreground mt-0.5">
                {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
