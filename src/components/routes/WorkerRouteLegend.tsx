import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Eye, EyeOff } from "lucide-react";

interface WorkerLegendItem {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  color: string;
  jobCount: number;
  distanceMeters: number;
  durationSeconds: number;
  visible: boolean;
}

interface WorkerRouteLegendProps {
  workers: WorkerLegendItem[];
  onToggleVisibility: (userId: string) => void;
  onToggleAll: (visible: boolean) => void;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function WorkerRouteLegend({
  workers,
  onToggleVisibility,
  onToggleAll,
}: WorkerRouteLegendProps) {
  const allVisible = workers.every((w) => w.visible);
  const noneVisible = workers.every((w) => !w.visible);

  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">
          Team Routes ({workers.length})
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onToggleAll(true)}
            disabled={allVisible}
          >
            <Eye className="h-3 w-3 mr-1" />
            Show All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onToggleAll(false)}
            disabled={noneVisible}
          >
            <EyeOff className="h-3 w-3 mr-1" />
            Hide All
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {workers.map((worker) => (
            <div
              key={worker.userId}
              className={`flex-shrink-0 p-3 rounded-lg border transition-all cursor-pointer ${
                worker.visible
                  ? "bg-background border-border"
                  : "bg-muted/50 border-muted opacity-60"
              }`}
              onClick={() => onToggleVisibility(worker.userId)}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={worker.avatarUrl || undefined} />
                    <AvatarFallback
                      style={{ backgroundColor: worker.color }}
                      className="text-white text-xs font-medium"
                    >
                      {getInitials(worker.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background"
                    style={{ backgroundColor: worker.color }}
                  />
                </div>
                <div className="min-w-[80px]">
                  <p className="text-sm font-medium truncate max-w-[100px]">
                    {worker.userName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {worker.jobCount} job{worker.jobCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(worker.distanceMeters)} • {formatDuration(worker.durationSeconds)}
                  </p>
                </div>
                <Checkbox
                  checked={worker.visible}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={() => onToggleVisibility(worker.userId)}
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
