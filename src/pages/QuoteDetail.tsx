import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Pencil, Send, Trash2, Copy, Briefcase, Download, Receipt } from "lucide-react";
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
import { QuoteStatusBadge } from "@/components/quotes/QuoteStatusBadge";
import { DeleteQuoteDialog } from "@/components/quotes/DeleteQuoteDialog";
import { SendQuoteDialog } from "@/components/quotes/SendQuoteDialog";
import { QuotePDF } from "@/components/quotes/QuotePDF";
import { JobFormDialog } from "@/components/jobs";
import { useQuote } from "@/hooks/useQuotes";
import { useBusiness } from "@/hooks/useBusiness";
import { format } from "date-fns";

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: quote, isLoading } = useQuote(id);

  const { data: business } = useBusiness();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

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

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quote not found.</p>
        <Button variant="link" onClick={() => navigate("/quotes")}>
          Back to Quotes
        </Button>
      </div>
    );
  }

  const customerName = quote.customer
    ? `${quote.customer.first_name} ${quote.customer.last_name}`
    : "Unknown Customer";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {quote.quote_number}
              </h1>
              <QuoteStatusBadge status={quote.status || "draft"} />
            </div>
            {quote.title && (
              <p className="text-muted-foreground">{quote.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPdfDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/quotes/${quote.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/quotes/new?duplicate=${quote.id}`)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
          {quote.status === "draft" && (
            <Button onClick={() => setSendDialogOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          )}
          {quote.status === "approved" && (
            <>
              <Button variant="outline" onClick={() => setJobDialogOpen(true)}>
                <Briefcase className="mr-2 h-4 w-4" />
                Create Job
              </Button>
              <Button onClick={() => navigate(`/invoices/new?quote_id=${quote.id}`)}>
                <Receipt className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </>
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
                  to={`/customers/${quote.customer_id}`}
                  className="text-lg font-medium hover:underline"
                >
                  {customerName}
                </Link>
                {quote.customer?.email && (
                  <p className="text-sm text-muted-foreground">
                    {quote.customer.email}
                  </p>
                )}
                {quote.customer?.phone && (
                  <p className="text-sm text-muted-foreground">
                    {quote.customer.phone}
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
                  {quote.quote_items.map((item) => (
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

          {/* Notes */}
          {(quote.notes || quote.internal_notes) && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {quote.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Customer Notes
                    </p>
                    <p className="whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                )}
                {quote.internal_notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Internal Notes
                    </p>
                    <p className="whitespace-pre-wrap">{quote.internal_notes}</p>
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
                <span>${Number(quote.subtotal).toFixed(2)}</span>
              </div>
              {Number(quote.discount_amount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">
                    -${Number(quote.discount_amount).toFixed(2)}
                  </span>
                </div>
              )}
              {Number(quote.tax_rate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax ({Number(quote.tax_rate)}%)
                  </span>
                  <span>${Number(quote.tax_amount).toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${Number(quote.total).toFixed(2)}</span>
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
                <span>{format(new Date(quote.created_at), "MMM d, yyyy")}</span>
              </div>
              {quote.valid_until && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until</span>
                  <span>{format(new Date(quote.valid_until), "MMM d, yyyy")}</span>
                </div>
              )}
              {quote.approved_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved</span>
                  <span>{format(new Date(quote.approved_at), "MMM d, yyyy")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteQuoteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        onSuccess={() => navigate("/quotes")}
      />

      <SendQuoteDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        customerName={customerName}
        customerEmail={quote.customer?.email}
      />

      <JobFormDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        defaultCustomerId={quote.customer_id}
        quoteId={quote.id}
        onSuccess={() => navigate("/jobs")}
      />

      {business && (
        <QuotePDF
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          quote={{
            ...quote,
            business: {
              id: business.id,
              name: business.name,
              phone: business.phone,
              email: business.email,
              logo_url: business.logo_url,
              address_line1: business.address_line1,
              city: business.city,
              state: business.state,
              zip: business.zip,
            },
          }}
        />
      )}
    </div>
  );
}
