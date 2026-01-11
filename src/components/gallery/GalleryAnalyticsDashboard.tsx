/**
 * Gallery Analytics Dashboard
 * Staff-facing analytics for photo gallery shares
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Eye, Download, Users, Link2, TrendingUp, ExternalLink } from 'lucide-react';
import { useGalleryAnalytics, type GalleryAnalyticsData } from '@/hooks/useGalleryAnalytics';
import { subDays, format } from 'date-fns';
import { cn } from '@/lib/utils';

const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function GalleryAnalyticsDashboard() {
  const [rangeDays, setRangeDays] = useState('30');

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = subDays(end, parseInt(rangeDays));
    return { start, end };
  }, [rangeDays]);

  const { data, isLoading, error } = useGalleryAnalytics(dateRange);

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load analytics data
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gallery Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track gallery views and engagement
          </p>
        </div>
        <Select value={rangeDays} onValueChange={setRangeDays}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Active Shares"
          value={data?.summary.totalActiveShares}
          icon={Link2}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Total Views"
          value={data?.summary.totalViews}
          icon={Eye}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Downloads"
          value={data?.summary.totalDownloads}
          icon={Download}
          isLoading={isLoading}
        />
        <SummaryCard
          title="Unique Viewers"
          value={data?.summary.uniqueViewers}
          icon={Users}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Views Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ChartContainer
                config={{
                  views: { label: 'Views', color: 'hsl(var(--primary))' },
                  downloads: { label: 'Downloads', color: 'hsl(var(--chart-2))' },
                }}
                className="h-64"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.viewTrends || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="downloads"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : data?.deviceBreakdown && data.deviceBreakdown.length > 0 ? (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.deviceBreakdown}
                      dataKey="count"
                      nameKey="device"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.deviceBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg px-3 py-2 shadow-md">
                              <p className="font-medium">{data.device}</p>
                              <p className="text-sm text-muted-foreground">
                                {data.count} views ({data.percentage}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col gap-1">
                  {data.deviceBreakdown.slice(0, 3).map((item, i) => (
                    <div key={item.device} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CHART_COLORS[i] }}
                      />
                      <span>{item.device}: {item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No device data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Galleries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Galleries</CardTitle>
          <CardDescription>Most viewed galleries by total view count</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.topGalleries && data.topGalleries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gallery</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Downloads</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topGalleries.map((gallery) => (
                  <TableRow key={gallery.id}>
                    <TableCell className="font-medium">
                      {gallery.title}
                    </TableCell>
                    <TableCell className="text-right">
                      {gallery.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {gallery.downloads.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {format(new Date(gallery.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No galleries have been shared yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value?: number;
  icon: React.ElementType;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-2xl font-bold">{value?.toLocaleString() ?? 0}</p>
            )}
          </div>
          <div className="p-2 rounded-full bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
