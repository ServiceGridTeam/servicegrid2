import { format } from "date-fns";
import { CreditCard, Banknote, Check, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@/hooks/useInvoices";
import { cn } from "@/lib/utils";

interface PaymentHistoryProps {
  payments: Payment[];
  className?: string;
}

const getPaymentMethodIcon = (method: string | null) => {
  switch (method) {
    case "card":
    case "stripe":
      return <CreditCard className="h-4 w-4" />;
    case "cash":
      return <Banknote className="h-4 w-4" />;
    case "check":
      return <Check className="h-4 w-4" />;
    default:
      return <Receipt className="h-4 w-4" />;
  }
};

const getPaymentMethodLabel = (method: string | null) => {
  switch (method) {
    case "card":
    case "stripe":
      return "Card";
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "bank_transfer":
      return "Bank Transfer";
    case "manual":
      return "Manual";
    default:
      return method || "Other";
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export function PaymentHistory({ payments, className }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No payments recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Payment History</CardTitle>
        <Badge variant="secondary" className="font-mono">
          Total: {formatCurrency(totalPaid)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className={cn(
              "flex items-start justify-between gap-4 rounded-lg border p-3",
              payment.status === "completed" ? "bg-background" : "bg-muted/50"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-muted p-2">
                {getPaymentMethodIcon(payment.payment_method)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {formatCurrency(Number(payment.amount))}
                  </span>
                  <Badge
                    variant={payment.status === "completed" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {payment.status || "pending"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {getPaymentMethodLabel(payment.payment_method)}
                  {payment.payment_reference && ` • Ref: ${payment.payment_reference}`}
                </p>
                {payment.notes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {payment.notes}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                {payment.paid_at
                  ? format(new Date(payment.paid_at), "MMM d, yyyy")
                  : format(new Date(payment.created_at), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {payment.paid_at
                  ? format(new Date(payment.paid_at), "h:mm a")
                  : format(new Date(payment.created_at), "h:mm a")}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
