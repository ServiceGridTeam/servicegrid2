import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useJobLaborCosts } from "@/hooks/useLaborCosts";
import { Clock, DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobLaborCardProps {
  jobId: string;
  estimatedMinutes?: number | null;
}

export function JobLaborCard({ jobId, estimatedMinutes }: JobLaborCardProps) {
  const { data: laborCosts, isLoading } = useJobLaborCosts(jobId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Labor Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!laborCosts || laborCosts.entryCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Labor Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No time entries recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalHours = laborCosts.totalMinutes / 60;
  const estimatedHours = estimatedMinutes ? estimatedMinutes / 60 : null;
  const variance = estimatedHours ? totalHours - estimatedHours : null;
  const variancePercent = estimatedHours && estimatedHours > 0
    ? ((variance ?? 0) / estimatedHours) * 100
    : null;
  
  const hasProfit = laborCosts.billableAmount > 0 && laborCosts.totalCost > 0;
  const profitMargin = hasProfit
    ? ((laborCosts.billableAmount - laborCosts.totalCost) / laborCosts.billableAmount) * 100
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)} hrs`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Labor Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hours Summary */}
        <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
          <div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Total Hours
            </div>
            <div className="text-lg font-semibold">
              {formatHours(totalHours)}
            </div>
          </div>
          {estimatedHours !== null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Estimated
              </div>
              <div className="text-lg font-semibold">
                {formatHours(estimatedHours)}
              </div>
            </div>
          )}
        </div>

        {/* Variance */}
        {variance !== null && (
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <span className="text-sm text-muted-foreground">Variance</span>
            <div className="flex items-center gap-2">
              {variance > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    +{formatHours(variance)} ({variancePercent?.toFixed(0)}% over)
                  </span>
                </>
              ) : variance < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {formatHours(Math.abs(variance))} ({Math.abs(variancePercent ?? 0).toFixed(0)}% under)
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium">On target</span>
              )}
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Labor Cost</span>
            <span className="font-mono font-medium">
              {formatCurrency(laborCosts.totalCost)}
            </span>
          </div>
          {laborCosts.billableAmount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Billable Amount</span>
              <span className="font-mono font-medium">
                {formatCurrency(laborCosts.billableAmount)}
              </span>
            </div>
          )}
          {profitMargin !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Profit Margin</span>
              <Badge
                variant={profitMargin >= 30 ? "default" : profitMargin >= 0 ? "secondary" : "destructive"}
                className="font-mono"
              >
                {profitMargin.toFixed(1)}%
              </Badge>
            </div>
          )}
        </div>

        {/* Worker Breakdown */}
        {Object.keys(laborCosts.byUser).length > 1 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <Users className="h-3 w-3" />
              By Worker
            </div>
            <div className="space-y-2">
              {Object.entries(laborCosts.byUser).map(([userId, data]) => (
                <div
                  key={userId}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={data.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {data.user?.first_name?.[0]}
                        {data.user?.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[120px]">
                      {data.user?.first_name} {data.user?.last_name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono">
                      {formatHours(data.minutes / 60)}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {formatCurrency(data.cost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
