import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  MapPin, 
  Navigation,
  ChevronRight
} from "lucide-react";
import type { WorkerRoute } from "./MultiWorkerRouteMap";

interface TeamMemberBase {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  max_daily_jobs?: number | null;
}

interface WorkerRouteSidebarProps {
  workerRoutes: WorkerRoute[];
  teamMembers: TeamMemberBase[];
  selectedWorkerId: string | null;
  onSelectWorker: (id: string | null) => void;
  isLoading: boolean;
  selectedDate: Date;
}

const ROUTE_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", 
  "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
];

interface DroppableWorkerRowProps {
  member: TeamMemberBase;
  route?: WorkerRoute;
  color?: string;
  jobCount: number;
  distanceMeters: number;
  maxJobs: number;
  isSelected: boolean;
  onSelect: () => void;
}

function DroppableWorkerRow({
  member,
  route,
  color,
  jobCount,
  distanceMeters,
  maxJobs,
  isSelected,
  onSelect,
}: DroppableWorkerRowProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `worker-${member.id}`,
    data: {
      type: "worker",
      workerId: member.id,
    },
  });

  const hasRoute = jobCount > 0;
  const capacityPercent = Math.min((jobCount / maxJobs) * 100, 100);

  const getInitials = (first?: string | null, last?: string | null) => {
    return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
  };

  const formatDistance = (meters: number) => {
    const miles = meters / 1609.34;
    return `${miles.toFixed(1)} mi`;
  };

  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      className={`w-full p-3 rounded-lg text-left transition-all ${
        isOver
          ? "bg-primary/20 ring-2 ring-primary ring-dashed"
          : isSelected
          ? "bg-primary/10 ring-1 ring-primary"
          : "hover:bg-muted/50"
      } ${!hasRoute && !isOver ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="h-9 w-9">
            <AvatarImage src={member.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(member.first_name, member.last_name)}
            </AvatarFallback>
          </Avatar>
          {color && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background"
              style={{ backgroundColor: color }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {member.first_name} {member.last_name}
            </span>
            {isSelected && (
              <ChevronRight className="h-3 w-3 text-primary shrink-0" />
            )}
          </div>
          
          {isOver ? (
            <p className="text-xs text-primary font-medium mt-1">
              Drop to assign job
            </p>
          ) : hasRoute ? (
            <>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {jobCount} jobs
                </span>
                <span className="flex items-center gap-1">
                  <Navigation className="h-3 w-3" />
                  {formatDistance(distanceMeters)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={capacityPercent} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground w-8">
                  {jobCount}/{maxJobs}
                </span>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              No jobs scheduled
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function WorkerRouteSidebar({
  workerRoutes,
  teamMembers,
  selectedWorkerId,
  onSelectWorker,
  isLoading,
  selectedDate,
}: WorkerRouteSidebarProps) {
  const workersWithRoutes = useMemo(() => {
    return teamMembers.map((member) => {
      const route = workerRoutes.find((wr) => wr.userId === member.id);
      const colorIndex = workerRoutes.findIndex((wr) => wr.userId === member.id);
      
      return {
        member,
        route,
        color: colorIndex >= 0 ? ROUTE_COLORS[colorIndex % ROUTE_COLORS.length] : undefined,
        jobCount: route?.jobs.length || 0,
        distanceMeters: route?.routePlan.total_distance_meters || 0,
        durationSeconds: route?.routePlan.total_duration_seconds || 0,
        maxJobs: member.max_daily_jobs || 8,
      };
    }).sort((a, b) => b.jobCount - a.jobCount);
  }, [teamMembers, workerRoutes]);

  if (isLoading) {
    return (
      <div className="w-72 border-r bg-background shrink-0 p-4 space-y-3">
        <Skeleton className="h-6 w-24" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-72 border-r bg-background shrink-0 flex flex-col">
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Team</h2>
          <Badge variant="secondary" className="ml-auto">
            {workersWithRoutes.filter((w) => w.jobCount > 0).length} active
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {workersWithRoutes.map(({ member, route, color, jobCount, distanceMeters, maxJobs }) => {
            const isSelected = selectedWorkerId === member.id;

            return (
              <DroppableWorkerRow
                key={member.id}
                member={member}
                route={route}
                color={color}
                jobCount={jobCount}
                distanceMeters={distanceMeters}
                maxJobs={maxJobs}
                isSelected={isSelected}
                onSelect={() => onSelectWorker(isSelected ? null : member.id)}
              />
            );
          })}

          {workersWithRoutes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No team members</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
