import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Home, Loader2, Route, Sparkles } from "lucide-react";
import { SortableRouteJobItem } from "./SortableRouteJobItem";
import { RouteOptimizationResultDialog } from "./RouteOptimizationResultDialog";
import { parseRouteLegs, RouteLeg } from "@/hooks/useRouteOptimization";
import { useOptimizeRoute } from "@/hooks/useRouteOptimization";
import type { DailyRoutePlan } from "@/types/routePlanning";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Job = Tables<"jobs">;

interface RouteMetrics {
  distanceMeters: number;
  durationSeconds: number;
}

interface SortableRouteListProps {
  routePlan: DailyRoutePlan;
  jobs: Job[];
  workerName?: string;
  onReorder: (newJobIds: string[]) => Promise<void>;
  onJobClick?: (jobId: string) => void;
  isOptimizing?: boolean;
}

export function SortableRouteList({
  routePlan,
  jobs,
  workerName,
  onReorder,
  onJobClick,
  isOptimizing = false,
}: SortableRouteListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [beforeMetrics, setBeforeMetrics] = useState<RouteMetrics | null>(null);
  const [afterMetrics, setAfterMetrics] = useState<RouteMetrics | null>(null);
  const [isOptimizingLocal, setIsOptimizingLocal] = useState(false);

  const optimizeRoute = useOptimizeRoute();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get current job order (use pending order if mid-drag, otherwise from route plan)
  const currentJobIds = pendingOrder ?? routePlan.job_ids ?? [];
  
  // Sort jobs by current order
  const orderedJobs = useMemo(() => {
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    return currentJobIds
      .map((id) => jobMap.get(id))
      .filter((j): j is Job => j !== undefined);
  }, [jobs, currentJobIds]);

  const legs = useMemo(() => parseRouteLegs(routePlan?.legs), [routePlan?.legs]);

  const startLocation = routePlan?.start_location as { lat: number; lng: number } | null;
  const endLocation = routePlan?.end_location as { lat: number; lng: number } | null;

  const activeJob = useMemo(
    () => orderedJobs.find((j) => j.id === activeId),
    [orderedJobs, activeId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) {
        setPendingOrder(null);
        return;
      }

      const oldIndex = currentJobIds.indexOf(active.id as string);
      const newIndex = currentJobIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) {
        setPendingOrder(null);
        return;
      }

      const newOrder = arrayMove(currentJobIds, oldIndex, newIndex);
      setPendingOrder(newOrder);
      setIsSaving(true);

      try {
        await onReorder(newOrder);
      } finally {
        setPendingOrder(null);
        setIsSaving(false);
      }
    },
    [currentJobIds, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setPendingOrder(null);
  }, []);

  const handleOptimize = useCallback(async () => {
    if (!routePlan.user_id) return;
    
    // Capture current metrics before optimization
    const currentBefore: RouteMetrics = {
      distanceMeters: routePlan.total_distance_meters || 0,
      durationSeconds: routePlan.total_duration_seconds || 0,
    };
    setBeforeMetrics(currentBefore);
    setIsOptimizingLocal(true);

    try {
      const result = await optimizeRoute.mutateAsync({
        userId: routePlan.user_id,
        date: routePlan.route_date,
      });

      setAfterMetrics({
        distanceMeters: result.totalDistanceMeters || 0,
        durationSeconds: result.totalDurationSeconds || 0,
      });
      setShowResultDialog(true);
      
      toast({
        title: "Route optimized",
        description: "Job order has been updated for the most efficient route.",
      });
    } catch (error) {
      console.error("Route optimization failed:", error);
      toast({
        title: "Optimization failed",
        description: error instanceof Error ? error.message : "Could not optimize route",
        variant: "destructive",
      });
    } finally {
      setIsOptimizingLocal(false);
    }
  }, [routePlan, optimizeRoute]);

  const hasChanges = pendingOrder !== null;
  const isAnyOptimizing = isOptimizing || isOptimizingLocal;

  if (orderedJobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Navigation className="mx-auto h-12 w-12 mb-3 opacity-50" />
          <p>No jobs assigned to this route</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              {workerName ? `${workerName}'s Route` : "Route Order"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOptimize}
                disabled={isAnyOptimizing || orderedJobs.length < 2}
                className="gap-1.5"
              >
                {isOptimizingLocal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Optimize
              </Button>
              {(isSaving || isAnyOptimizing) && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {isAnyOptimizing ? "Optimizing..." : "Saving..."}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                Drag to reorder
              </Badge>
            </div>
          </div>
        </CardHeader>
      <CardContent className="pt-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={orderedJobs.map((j) => j.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="relative">
              {/* Start location */}
              {startLocation && (
                <div className="flex items-start gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Home className="h-4 w-4 text-primary" />
                    </div>
                    <div className="w-0.5 flex-1 bg-border mt-2" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium text-sm">Start: Home</p>
                  </div>
                </div>
              )}

              {/* Sortable jobs */}
              {orderedJobs.map((job, index) => {
                const leg = legs[startLocation ? index + 1 : index];
                return (
                  <SortableRouteJobItem
                    key={job.id}
                    job={job}
                    index={index}
                    isLast={index === orderedJobs.length - 1 && !endLocation}
                    driveTimeSeconds={leg?.durationSeconds}
                    driveDistanceMeters={leg?.distanceMeters}
                    onJobClick={onJobClick}
                  />
                );
              })}

              {/* End location */}
              {endLocation && (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Home className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-medium text-sm">End: Home</p>
                  </div>
                </div>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeJob && (
              <div className="bg-card border rounded-lg p-3 shadow-lg">
                <p className="font-medium text-sm">{activeJob.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[activeJob.address_line1, activeJob.city].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>

      <RouteOptimizationResultDialog
        open={showResultDialog}
        onOpenChange={setShowResultDialog}
        before={beforeMetrics}
        after={afterMetrics}
      />
    </>
  );
}
