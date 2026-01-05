import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Signal, SignalLow, SignalMedium, SignalZero } from "lucide-react";

interface LocationAccuracyIndicatorProps {
  accuracy: number | null;
  className?: string;
}

export function LocationAccuracyIndicator({ accuracy, className }: LocationAccuracyIndicatorProps) {
  const getAccuracyInfo = () => {
    if (accuracy === null) {
      return { 
        Icon: SignalZero, 
        color: "text-muted-foreground", 
        label: "No GPS signal",
        description: "Unable to determine location"
      };
    }
    if (accuracy <= 10) {
      return { 
        Icon: Signal, 
        color: "text-green-500", 
        label: "High accuracy",
        description: `Accurate to ${Math.round(accuracy)} meters`
      };
    }
    if (accuracy <= 50) {
      return { 
        Icon: SignalMedium, 
        color: "text-yellow-500", 
        label: "Medium accuracy",
        description: `Accurate to ${Math.round(accuracy)} meters`
      };
    }
    return { 
      Icon: SignalLow, 
      color: "text-destructive", 
      label: "Low accuracy",
      description: `Accurate to ${Math.round(accuracy)} meters`
    };
  };

  const { Icon, color, label, description } = getAccuracyInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1", className)}>
            <Icon className={cn("h-4 w-4", color)} />
            <span className={cn("text-xs font-medium", color)}>{label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
