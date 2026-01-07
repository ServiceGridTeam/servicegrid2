import { Badge } from "@/components/ui/badge";
import { Sparkles, Settings2, Type, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailClassification, ClassificationTier, ClassificationStage } from "@/hooks/useInboundEmails";

interface ClassificationBadgeProps {
  classification: EmailClassification | null;
  confidence?: number | null;
  tier?: ClassificationTier | null;
  stage?: ClassificationStage;
  showTier?: boolean;
  showConfidence?: boolean;
  size?: "sm" | "default";
}

const classificationConfig: Record<EmailClassification, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  service_request: { label: "Service Request", variant: "default" },
  inquiry: { label: "Inquiry", variant: "secondary" },
  spam: { label: "Spam", variant: "destructive" },
  out_of_scope: { label: "Out of Scope", variant: "outline" },
  unclassified: { label: "Unclassified", variant: "outline" },
};

const stageLabels: Record<ClassificationStage, string> = {
  pending: "Pending",
  analyzing: "Analyzing...",
  reading: "Reading...",
  extracting: "Extracting...",
  complete: "Complete",
  failed: "Failed",
};

const TierIcon = ({ tier }: { tier: ClassificationTier }) => {
  const iconClass = "h-3 w-3";
  
  switch (tier) {
    case "ai":
      return <Sparkles className={iconClass} />;
    case "rules":
      return <Settings2 className={iconClass} />;
    case "keywords":
      return <Type className={iconClass} />;
    default:
      return null;
  }
};

export function ClassificationBadge({
  classification,
  confidence,
  tier,
  stage = "complete",
  showTier = true,
  showConfidence = false,
  size = "default",
}: ClassificationBadgeProps) {
  // Show loading state for in-progress classification
  if (stage !== "complete" && stage !== "failed") {
    return (
      <Badge variant="outline" className={cn("gap-1", size === "sm" && "text-xs px-1.5 py-0.5")}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{stageLabels[stage]}</span>
      </Badge>
    );
  }

  // Show failed state
  if (stage === "failed") {
    return (
      <Badge variant="destructive" className={cn(size === "sm" && "text-xs px-1.5 py-0.5")}>
        Classification Failed
      </Badge>
    );
  }

  // No classification yet
  if (!classification) {
    return (
      <Badge variant="outline" className={cn(size === "sm" && "text-xs px-1.5 py-0.5")}>
        Unclassified
      </Badge>
    );
  }

  const config = classificationConfig[classification];

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        "gap-1",
        size === "sm" && "text-xs px-1.5 py-0.5"
      )}
      title={showConfidence && confidence ? `Confidence: ${Math.round(confidence * 100)}%` : undefined}
    >
      {showTier && tier && <TierIcon tier={tier} />}
      <span>{config.label}</span>
      {showConfidence && confidence && (
        <span className="opacity-70 text-xs">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </Badge>
  );
}

// Confidence bar component
interface ConfidenceBarProps {
  confidence: number | null;
  className?: string;
}

export function ConfidenceBar({ confidence, className }: ConfidenceBarProps) {
  if (confidence === null) return null;

  const percentage = Math.round(confidence * 100);
  const colorClass = 
    percentage >= 85 ? "bg-green-500" :
    percentage >= 60 ? "bg-yellow-500" :
    "bg-red-500";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8">
        {percentage}%
      </span>
    </div>
  );
}
