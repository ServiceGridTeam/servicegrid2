import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { QuoteDetailsForm } from "@/components/quotes/QuoteDetailsForm";
import { LineItemsEditor, LineItem } from "@/components/quotes/LineItemsEditor";
import { QuoteSummaryCard } from "@/components/quotes/QuoteSummaryCard";
import { SendQuoteDialog } from "@/components/quotes/SendQuoteDialog";
import { useQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useQuoteCalculations } from "@/hooks/useQuoteCalculations";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";

export default function QuoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: quote, isLoading } = useQuote(id);
  const updateQuote = useUpdateQuote();

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<{
    first_name: string;
    last_name: string;
    email?: string | null;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Initialize form from quote data
  useEffect(() => {
    if (quote && !initialized) {
      setSelectedCustomerId(quote.customer_id);
      if (quote.customer) {
        setSelectedCustomer({
          first_name: quote.customer.first_name,
          last_name: quote.customer.last_name,
          email: quote.customer.email,
        });
      }
      setTitle(quote.title || "");
      setValidUntil(quote.valid_until ? new Date(quote.valid_until) : undefined);
      setTaxRate(Number(quote.tax_rate) || 0);
      setDiscountAmount(Number(quote.discount_amount) || 0);
      setNotes(quote.notes || "");
      setInternalNotes(quote.internal_notes || "");
      
      if (quote.quote_items.length > 0) {
        setItems(
          quote.quote_items.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
          }))
        );
      } else {
        setItems([
          { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 },
        ]);
      }
      setInitialized(true);
    }
  }, [quote, initialized]);

  const calculations = useQuoteCalculations({
    items,
    discountAmount,
    taxRate,
  });

  const handleCustomerSelect = (
    customerId: string,
    customer: { first_name: string; last_name: string; email?: string | null }
  ) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomer(customer);
  };

  const handleSave = async (sendAfterSave = false) => {
    if (!id) return;

    if (!selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please select a customer.",
        variant: "destructive",
      });
      return;
    }

    const validItems = items.filter((item) => item.description.trim());
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one line item with a description.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateQuote.mutateAsync({
        id,
        quote: {
          customer_id: selectedCustomerId,
          title: title || null,
          valid_until: validUntil?.toISOString().split("T")[0] || null,
          tax_rate: taxRate,
          discount_amount: discountAmount,
          notes: notes || null,
          internal_notes: internalNotes || null,
          subtotal: calculations.subtotal,
          tax_amount: calculations.taxAmount,
          total: calculations.total,
        },
        items: validItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
      });

      if (sendAfterSave) {
        setSendDialogOpen(true);
      } else {
        toast({
          title: "Quote updated",
          description: "Your changes have been saved.",
        });
        navigate(`/quotes/${id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canSend = selectedCustomerId && items.some((item) => item.description.trim());

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/quotes/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit Quote {quote.quote_number}
          </h1>
          <p className="text-muted-foreground">
            Update quote details and line items
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Customer & Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Select Customer</Label>
                <CustomerSelector
                  value={selectedCustomerId}
                  onValueChange={handleCustomerSelect}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteDetailsForm
                title={title}
                onTitleChange={setTitle}
                validUntil={validUntil}
                onValidUntilChange={setValidUntil}
                taxRate={taxRate}
                onTaxRateChange={setTaxRate}
                discountAmount={discountAmount}
                onDiscountAmountChange={setDiscountAmount}
                notes={notes}
                onNotesChange={setNotes}
                internalNotes={internalNotes}
                onInternalNotesChange={setInternalNotes}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <LineItemsEditor items={items} onItemsChange={setItems} />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Summary */}
        <div>
          <QuoteSummaryCard
            subtotal={calculations.subtotal}
            discountAmount={calculations.discountAmount}
            taxRate={taxRate}
            taxAmount={calculations.taxAmount}
            total={calculations.total}
            onSaveDraft={() => handleSave(false)}
            onSend={() => handleSave(true)}
            isSaving={updateQuote.isPending}
            canSend={canSend}
          />
        </div>
      </div>

      {id && selectedCustomer && (
        <SendQuoteDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          quoteId={id}
          quoteNumber={quote.quote_number}
          customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
          customerEmail={selectedCustomer.email}
          onSuccess={() => navigate(`/quotes/${id}`)}
        />
      )}
    </div>
  );
}
