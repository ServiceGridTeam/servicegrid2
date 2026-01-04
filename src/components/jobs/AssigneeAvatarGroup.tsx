import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Assignee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
}

interface AssigneeAvatarGroupProps {
  assignees: Assignee[];
  max?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
};

const overlapClasses = {
  sm: "-ml-1.5",
  md: "-ml-2",
  lg: "-ml-2.5",
};

export function AssigneeAvatarGroup({ 
  assignees, 
  max = 3, 
  size = "md",
  className 
}: AssigneeAvatarGroupProps) {
  if (assignees.length === 0) {
    return null;
  }

  const visibleAssignees = assignees.slice(0, max);
  const remainingCount = assignees.length - max;

  return (
    <div className={cn("flex items-center", className)}>
      {visibleAssignees.map((assignee, index) => (
        <Tooltip key={assignee.id}>
          <TooltipTrigger asChild>
            <Avatar 
              className={cn(
                sizeClasses[size],
                "border-2 border-background ring-0",
                index > 0 && overlapClasses[size]
              )}
            >
              <AvatarImage src={assignee.avatar_url || undefined} />
              <AvatarFallback className={sizeClasses[size]}>
                {assignee.first_name?.[0]}
                {assignee.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {assignee.first_name} {assignee.last_name}
            {index === 0 && assignees.length > 1 && " (Lead)"}
          </TooltipContent>
        </Tooltip>
      ))}
      
      {remainingCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-center justify-center rounded-full bg-muted border-2 border-background font-medium",
                sizeClasses[size],
                overlapClasses[size]
              )}
            >
              +{remainingCount}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {assignees.slice(max).map(a => `${a.first_name} ${a.last_name}`).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
