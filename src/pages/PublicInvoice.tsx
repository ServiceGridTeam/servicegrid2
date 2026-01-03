import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Building2, Calendar, FileText, CreditCard, Check, AlertTriangle } from "lucide-react";
import { useInvoiceByToken } from "@/hooks/usePublicInvoice";
import { InvoicePDF } from "@/components/invoices/InvoicePDF";
import { format, isPast } from "date-fns";
import { useState } from "react";

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const { data: invoice, isLoading, error } = useInvoiceByToken(token);
  const [pdfOpen, setPdfOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
            <p className="text-muted-foreground">
              This invoice link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = invoice.business;
  const customer = invoice.customer;
  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.due_date && isPast(new Date(invoice.due_date)) && !isPaid;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Business Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {business?.logo_url ? (
                  <img
                    src={business.logo_url}
                    alt={business.name}
                    className="h-16 w-16 object-contain rounded"
                  />
                ) : (
                  <div className="h-16 w-16 bg-primary/10 rounded flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold">{business?.name}</h1>
                  {business?.phone && (
                    <p className="text-sm text-muted-foreground">{business.phone}</p>
                  )}
                  {business?.email && (
                    <p className="text-sm text-muted-foreground">{business.email}</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPdfOpen(true)}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Invoice {invoice.invoice_number}</CardTitle>
              </div>
              <InvoiceStatusBadge status={invoice.status} isOverdue={isOverdue} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Bill To</p>
                <p className="font-medium">
                  {customer?.first_name} {customer?.last_name}
                </p>
                {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
              </div>
              <div className="sm:text-right space-y-1">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Issued:</span>
                  <span>{format(new Date(invoice.created_at), "MMM d, yyyy")}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span className="text-muted-foreground">Due:</span>
                    <span className={isOverdue ? "text-destructive font-medium" : ""}>
                      {format(new Date(invoice.due_date), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Warning */}
        {isOverdue && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">This invoice is overdue</p>
                  <p className="text-sm text-muted-foreground">
                    Please submit payment as soon as possible to avoid late fees.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Paid Confirmation */}
        {isPaid && (
          <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    Payment Received
                  </p>
                  {invoice.paid_at && (
                    <p className="text-sm text-muted-foreground">
                      Paid on {format(new Date(invoice.paid_at), "MMMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.invoice_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${Number(item.unit_price).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(item.total).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="mt-6 border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">
                    -${Number(invoice.discount_amount).toFixed(2)}
                  </span>
                </div>
              )}
              {Number(invoice.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({Number(invoice.tax_rate)}%)
                  </span>
                  <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && !isPaid && (
                <>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Paid</span>
                    <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Balance Due</span>
                    <span>${Number(invoice.balance_due).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Pay Now Button (placeholder for Stripe) */}
        {!isPaid && Number(invoice.balance_due) > 0 && (
          <Card>
            <CardContent className="pt-6">
              <Button className="w-full" size="lg" disabled>
                <CreditCard className="mr-2 h-5 w-5" />
                Pay ${Number(invoice.balance_due).toFixed(2)} Now
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Online payment coming soon. Please contact us for payment options.
              </p>
            </CardContent>
          </Card>
        )}

        <InvoicePDF
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          invoice={invoice}
        />
      </div>
    </div>
  );
}

function InvoiceStatusBadge({ status, isOverdue }: { status: string | null; isOverdue: boolean }) {
  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  switch (status) {
    case "paid":
      return <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>;
    case "sent":
      return <Badge variant="secondary">Awaiting Payment</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
