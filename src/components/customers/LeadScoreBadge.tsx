import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadScoreBadgeProps {
  score: number;
  status?: string;
  showScore?: boolean;
  className?: string;
}

export function LeadScoreBadge({
  score,
  status,
  showScore = true,
  className,
}: LeadScoreBadgeProps) {
  if (status === "qualified") {
    return (
      <Badge className={cn("bg-green-500 hover:bg-green-600", className)}>
        Qualified
      </Badge>
    );
  }

  if (status === "converted") {
    return (
      <Badge className={cn("bg-blue-500 hover:bg-blue-600", className)}>
        Converted
      </Badge>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 61) return "bg-green-500 hover:bg-green-600";
    if (score >= 31) return "bg-yellow-500 hover:bg-yellow-600";
    return "bg-red-500 hover:bg-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 61) return "Hot";
    if (score >= 31) return "Warm";
    return "Cold";
  };

  return (
    <Badge className={cn(getScoreColor(score), className)}>
      {showScore ? `${score} - ${getScoreLabel(score)}` : getScoreLabel(score)}
    </Badge>
  );
}
