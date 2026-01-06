import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useJobRequests } from "@/hooks/useJobRequests";

export function RequestStats() {
  const { data: pendingRequests } = useJobRequests({ status: "pending" });
  const { data: reviewingRequests } = useJobRequests({ status: "reviewing" });
  const { data: approvedRequests } = useJobRequests({ status: ["approved", "converted"] });

  // Filter approved to only show today's
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const approvedToday = approvedRequests?.filter((r) => {
    if (!r.reviewed_at) return false;
    const reviewedDate = new Date(r.reviewed_at);
    return reviewedDate >= today;
  }) || [];

  const stats = [
    {
      label: "Pending",
      count: pendingRequests?.length || 0,
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      label: "Reviewing",
      count: reviewingRequests?.length || 0,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      label: "Approved Today",
      count: approvedToday.length,
      icon: CheckCircle,
      color: "text-success",
      bgColor: "bg-success/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="flex items-center gap-3 p-4">
            <div className={`rounded-full p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
