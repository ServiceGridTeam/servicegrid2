import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import { QuoteDetailsForm } from "@/components/quotes/QuoteDetailsForm";
import { LineItemsEditor, LineItem } from "@/components/quotes/LineItemsEditor";
import { QuoteSummaryCard } from "@/components/quotes/QuoteSummaryCard";
import { SendQuoteDialog } from "@/components/quotes/SendQuoteDialog";
import { useCreateQuote, useQuote } from "@/hooks/useQuotes";
import { useQuoteCalculations } from "@/hooks/useQuoteCalculations";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";
import { Label } from "@/components/ui/label";

export default function QuoteNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const customerId = searchParams.get("customer_id");
  const { toast } = useToast();
  const { data: business } = useBusiness();
  const createQuote = useCreateQuote();
  const { data: duplicateQuote } = useQuote(duplicateId || undefined);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<{
    first_name: string;
    last_name: string;
    email?: string | null;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [validUntil, setValidUntil] = useState<Date | undefined>(addDays(new Date(), 30));
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 },
  ]);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  // Pre-fill from duplicate quote
  useEffect(() => {
    if (duplicateQuote) {
      setSelectedCustomerId(duplicateQuote.customer_id);
      if (duplicateQuote.customer) {
        setSelectedCustomer({
          first_name: duplicateQuote.customer.first_name,
          last_name: duplicateQuote.customer.last_name,
          email: duplicateQuote.customer.email,
        });
      }
      setTitle(duplicateQuote.title || "");
      setTaxRate(Number(duplicateQuote.tax_rate) || 0);
      setDiscountAmount(Number(duplicateQuote.discount_amount) || 0);
      setNotes(duplicateQuote.notes || "");
      setInternalNotes(duplicateQuote.internal_notes || "");
      if (duplicateQuote.quote_items.length > 0) {
        setItems(
          duplicateQuote.quote_items.map((item) => ({
            id: crypto.randomUUID(),
            description: item.description,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
          }))
        );
      }
    }
  }, [duplicateQuote]);

  // Pre-fill customer from URL param
  useEffect(() => {
    if (customerId && !duplicateId) {
      setSelectedCustomerId(customerId);
    }
  }, [customerId, duplicateId]);

  const calculations = useQuoteCalculations({
    items,
    discountAmount,
    taxRate,
  });

  const handleCustomerSelect = (
    id: string,
    customer: { first_name: string; last_name: string; email?: string | null }
  ) => {
    setSelectedCustomerId(id);
    setSelectedCustomer(customer);
  };

  const handleSave = async (sendAfterSave = false) => {
    if (!selectedCustomerId) {
      toast({
        title: "Error",
        description: "Please select a customer.",
        variant: "destructive",
      });
      return;
    }

    if (!business?.id) {
      toast({
        title: "Error",
        description: "Business not found.",
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
      const result = await createQuote.mutateAsync({
        quote: {
          business_id: business.id,
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
          status: "draft",
        },
        items: validItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
      });

      if (sendAfterSave) {
        setSavedQuoteId(result.id);
        setSendDialogOpen(true);
      } else {
        toast({
          title: "Quote created",
          description: `Quote ${result.quote_number} has been saved as draft.`,
        });
        navigate(`/quotes/${result.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canSend = selectedCustomerId && items.some((item) => item.description.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {duplicateId ? "Duplicate Quote" : "New Quote"}
          </h1>
          <p className="text-muted-foreground">
            Create a new quote for a customer
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
            isSaving={createQuote.isPending}
            canSend={canSend}
          />
        </div>
      </div>

      {savedQuoteId && selectedCustomer && (
        <SendQuoteDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          quoteId={savedQuoteId}
          quoteNumber="(new)"
          customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
          customerEmail={selectedCustomer.email}
          onSuccess={() => navigate(`/quotes/${savedQuoteId}`)}
        />
      )}
    </div>
  );
}
