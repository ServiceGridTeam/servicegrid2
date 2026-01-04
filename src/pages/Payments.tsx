import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  CreditCard,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { usePayments, usePaymentStats, useRevenueByMonth } from "@/hooks/usePayments";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-all">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 text-xs mt-1">
          {trend && (
            <span className={`flex items-center gap-0.5 ${trendUp ? "text-emerald-600" : "text-red-600"}`}>
              {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend}
            </span>
          )}
          <span className="text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentStatusBadge({ status }: { status: string | null }) {
  if (status === "completed") {
    return (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
        <CheckCircle className="mr-1 h-3 w-3" />
        Completed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      {status || "Unknown"}
    </Badge>
  );
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export default function Payments() {
  const { data: payments, isLoading: paymentsLoading } = usePayments();
  const { data: stats, isLoading: statsLoading } = usePaymentStats();
  const { data: revenueData, isLoading: revenueLoading } = useRevenueByMonth();

  const pieData = stats ? [
    { name: "Successful", value: stats.successfulPayments, color: "hsl(var(--chart-2))" },
    { name: "Failed", value: stats.failedPayments, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0) : [];

  if (statsLoading || paymentsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const hasPayments = payments && payments.length > 0;
  const hasRevenue = revenueData?.some(d => d.revenue > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments Dashboard</h1>
        <p className="text-muted-foreground">
          Track payment performance, revenue trends, and transaction history.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          description="All time"
          icon={DollarSign}
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats?.revenueThisMonth || 0)}
          description="vs last month"
          icon={TrendingUp}
          trend={stats?.revenueTrend !== undefined ? `${stats.revenueTrend > 0 ? "+" : ""}${stats.revenueTrend.toFixed(1)}%` : undefined}
          trendUp={stats?.revenueTrend !== undefined && stats.revenueTrend >= 0}
        />
        <StatCard
          title="Success Rate"
          value={`${(stats?.successRate || 100).toFixed(1)}%`}
          description={`${stats?.successfulPayments || 0} successful`}
          icon={CheckCircle}
        />
        <StatCard
          title="Failed Payments"
          value={`${stats?.failedPayments || 0}`}
          description="Needs attention"
          icon={XCircle}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {hasRevenue ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      fill="url(#revenueGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-3">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No revenue data yet</p>
                <p className="text-sm text-muted-foreground">
                  Revenue trends will appear once you receive payments
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success/Failure Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              Payment Status
            </CardTitle>
            <CardDescription>Success vs failure breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2">
                  {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-3">
                  <CreditCard className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No payment data</p>
                <p className="text-sm text-muted-foreground">
                  Payment breakdown will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Recent Transactions
          </CardTitle>
          <CardDescription>Your latest payment activity</CardDescription>
        </CardHeader>
        <CardContent>
          {hasPayments ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.slice(0, 10).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-muted-foreground">
                      {payment.paid_at 
                        ? format(new Date(payment.paid_at), "MMM d, yyyy")
                        : format(new Date(payment.created_at), "MMM d, yyyy")
                      }
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.invoice?.invoice_number || "—"}
                    </TableCell>
                    <TableCell>
                      {payment.invoice?.customer 
                        ? `${payment.invoice.customer.first_name} ${payment.invoice.customer.last_name}`
                        : "—"
                      }
                    </TableCell>
                    <TableCell className="capitalize">
                      {payment.payment_method || "Card"}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={payment.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Payment transactions will appear here once customers pay invoices
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
