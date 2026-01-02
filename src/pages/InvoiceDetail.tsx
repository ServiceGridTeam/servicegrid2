import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Send, Trash2, CreditCard, FileText, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InvoiceStatusBadge,
  DeleteInvoiceDialog,
  SendInvoiceDialog,
  RecordPaymentDialog,
} from "@/components/invoices";
import { useInvoice } from "@/hooks/useInvoices";
import { format } from "date-fns";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Button variant="link" onClick={() => navigate("/invoices")}>
          Back to Invoices
        </Button>
      </div>
    );
  }

  const customerName = invoice.customer
    ? `${invoice.customer.first_name} ${invoice.customer.last_name}`
    : "Unknown Customer";

  const canRecordPayment = invoice.status === "sent" || invoice.status === "overdue";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {invoice.invoice_number}
              </h1>
              <InvoiceStatusBadge status={invoice.status || "draft"} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          {invoice.status === "draft" && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          )}
          {canRecordPayment && (
            <Button onClick={() => setPaymentDialogOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Details & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Link
                  to={`/customers/${invoice.customer_id}`}
                  className="text-lg font-medium hover:underline"
                >
                  {customerName}
                </Link>
                {invoice.customer?.email && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.customer.email}
                  </p>
                )}
                {invoice.customer?.phone && (
                  <p className="text-sm text-muted-foreground">
                    {invoice.customer.phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
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
                      <TableCell className="text-right">
                        ${Number(item.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {payment.paid_at
                            ? format(new Date(payment.paid_at), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell className="capitalize">
                          {payment.payment_method?.replace("_", " ") || "-"}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          +${Number(payment.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {(invoice.notes || invoice.internal_notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Customer Notes
                    </p>
                    <p className="whitespace-pre-wrap">{invoice.notes}</p>
                  </div>
                )}
                {invoice.internal_notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Internal Notes
                    </p>
                    <p className="whitespace-pre-wrap">{invoice.internal_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-600">
                  ${Number(invoice.amount_paid).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Balance Due</span>
                <span className={Number(invoice.balance_due) > 0 ? "text-destructive" : "text-green-600"}>
                  ${Number(invoice.balance_due).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(invoice.created_at), "MMM d, yyyy")}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{format(new Date(invoice.due_date), "MMM d, yyyy")}</span>
                </div>
              )}
              {invoice.sent_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent</span>
                  <span>{format(new Date(invoice.sent_at), "MMM d, yyyy")}</span>
                </div>
              )}
              {invoice.paid_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid</span>
                  <span>{format(new Date(invoice.paid_at), "MMM d, yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related */}
          {(invoice.job || invoice.quote) && (
            <Card>
              <CardHeader>
                <CardTitle>Related</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoice.job && (
                  <Link
                    to={`/jobs`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Briefcase className="h-4 w-4" />
                    {invoice.job.job_number} - {invoice.job.title || "Job"}
                  </Link>
                )}
                {invoice.quote && (
                  <Link
                    to={`/quotes/${invoice.quote.id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {invoice.quote.quote_number} - {invoice.quote.title || "Quote"}
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <DeleteInvoiceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        onSuccess={() => navigate("/invoices")}
      />

      <SendInvoiceDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        customerName={customerName}
        customerEmail={invoice.customer?.email}
      />

      <RecordPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        balanceDue={Number(invoice.balance_due)}
      />
    </div>
  );
}
