import { useState, useEffect } from "react";
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
import { Check, X, Download, Building2, Calendar, FileText } from "lucide-react";
import { SignatureDialog } from "@/components/quotes/SignatureDialog";
import { QuotePDF } from "@/components/quotes/QuotePDF";
import { useQuoteByToken, useApproveQuote, useDeclineQuote } from "@/hooks/usePublicQuote";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const { data: quote, isLoading, error } = useQuoteByToken(token);
  const approveQuote = useApproveQuote();
  const declineQuote = useDeclineQuote();
  
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const handleApprove = async (signatureData: { signature: string; name: string }) => {
    if (!quote) return;
    
    try {
      await approveQuote.mutateAsync({
        id: quote.id,
        signature_url: signatureData.signature,
        approved_by: signatureData.name,
      });
      toast.success("Quote approved successfully!");
      setSignatureDialogOpen(false);
    } catch (err) {
      toast.error("Failed to approve quote");
    }
  };

  const handleDecline = async () => {
    if (!quote) return;
    
    if (!confirm("Are you sure you want to decline this quote?")) return;
    
    try {
      await declineQuote.mutateAsync(quote.id);
      toast.success("Quote declined");
    } catch (err) {
      toast.error("Failed to decline quote");
    }
  };

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

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">
              This quote link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const business = quote.business;
  const customer = quote.customer;
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const canRespond = quote.status === "sent" || quote.status === "viewed";

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

        {/* Quote Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Quote {quote.quote_number}</CardTitle>
                {quote.title && (
                  <p className="text-muted-foreground mt-1">{quote.title}</p>
                )}
              </div>
              <StatusBadge status={quote.status} isExpired={isExpired} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Prepared For</p>
                <p className="font-medium">
                  {customer?.first_name} {customer?.last_name}
                </p>
                {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
              </div>
              <div className="sm:text-right">
                <div className="flex items-center gap-2 sm:justify-end">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(quote.created_at), "MMM d, yyyy")}</span>
                </div>
                {quote.valid_until && (
                  <div className="flex items-center gap-2 sm:justify-end mt-1">
                    <span className="text-muted-foreground">Valid Until:</span>
                    <span className={isExpired ? "text-destructive" : ""}>
                      {format(new Date(quote.valid_until), "MMM d, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                {quote.quote_items.map((item) => (
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
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {quote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{quote.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Signature (if approved) */}
        {quote.status === "approved" && quote.signature_url && (
          <Card>
            <CardHeader>
              <CardTitle>Approval Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <img
                  src={quote.signature_url}
                  alt="Signature"
                  className="h-16 border-b border-border"
                />
                <div>
                  <p className="font-medium">{quote.approved_by}</p>
                  {quote.approved_at && (
                    <p className="text-sm text-muted-foreground">
                      Approved on {format(new Date(quote.approved_at), "MMMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {canRespond && !isExpired && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={() => setSignatureDialogOpen(true)}
                  disabled={approveQuote.isPending}
                >
                  <Check className="mr-2 h-5 w-5" />
                  Approve Quote
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  size="lg"
                  onClick={handleDecline}
                  disabled={declineQuote.isPending}
                >
                  <X className="mr-2 h-5 w-5" />
                  Decline
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3">
                By approving, you agree to the terms and pricing above.
              </p>
            </CardContent>
          </Card>
        )}

        {isExpired && canRespond && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 text-center">
              <p className="text-destructive font-medium">This quote has expired.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please contact us for an updated quote.
              </p>
            </CardContent>
          </Card>
        )}

        <SignatureDialog
          open={signatureDialogOpen}
          onOpenChange={setSignatureDialogOpen}
          onConfirm={handleApprove}
          isLoading={approveQuote.isPending}
        />

        <QuotePDF
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          quote={quote}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status, isExpired }: { status: string | null; isExpired: boolean }) {
  if (isExpired && (status === "sent" || status === "viewed")) {
    return <Badge variant="destructive">Expired</Badge>;
  }

  switch (status) {
    case "approved":
      return <Badge className="bg-green-500 hover:bg-green-600">Approved</Badge>;
    case "declined":
      return <Badge variant="destructive">Declined</Badge>;
    case "sent":
    case "viewed":
      return <Badge variant="secondary">Awaiting Response</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
