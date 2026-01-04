import { Badge } from "@/components/ui/badge";
import { OvertimeResult, formatMinutesToHoursDecimal, getOvertimeStatus } from "@/hooks/useOvertimeCalculations";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OvertimeBadgeProps {
  result: OvertimeResult;
  thresholdHours: number;
  showDetails?: boolean;
  className?: string;
}

export function OvertimeBadge({ result, thresholdHours, showDetails = false, className }: OvertimeBadgeProps) {
  const status = getOvertimeStatus(result);
  const totalHours = formatMinutesToHoursDecimal(result.totalMinutes);
  const overtimeHours = formatMinutesToHoursDecimal(result.overtimeMinutes);

  if (status === "overtime") {
    return (
      <Badge
        variant="destructive"
        className={cn("gap-1 font-mono", className)}
      >
        <AlertTriangle className="h-3 w-3" />
        {showDetails ? (
          <span>+{overtimeHours}h OT</span>
        ) : (
          <span>OVERTIME +{overtimeHours}h</span>
        )}
      </Badge>
    );
  }

  if (status === "approaching") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 font-mono border-yellow-500 text-yellow-600 dark:text-yellow-400 bg-yellow-500/10",
          className
        )}
      >
        <Clock className="h-3 w-3" />
        {showDetails ? (
          <span>{totalHours}/{thresholdHours}h</span>
        ) : (
          <span>{Math.round(result.percentOfThreshold)}% of limit</span>
        )}
      </Badge>
    );
  }

  // Normal status
  if (showDetails) {
    return (
      <Badge variant="secondary" className={cn("font-mono", className)}>
        {totalHours} hrs
      </Badge>
    );
  }

  return null;
}
