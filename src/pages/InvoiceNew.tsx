import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import {
  InvoiceDetailsForm,
  InvoiceLineItemsEditor,
  InvoiceSummaryCard,
  SendInvoiceDialog,
  type InvoiceLineItem,
} from "@/components/invoices";
import { useCreateInvoice, useInvoice } from "@/hooks/useInvoices";
import { useQuote } from "@/hooks/useQuotes";
import { useJob } from "@/hooks/useJobs";
import { useInvoiceCalculations } from "@/hooks/useInvoiceCalculations";
import { useBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/hooks/use-toast";
import { addDays } from "date-fns";

export default function InvoiceNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteId = searchParams.get("quote_id");
  const jobId = searchParams.get("job_id");
  const customerId = searchParams.get("customer_id");
  const { toast } = useToast();
  const { data: business } = useBusiness();
  const createInvoice = useCreateInvoice();
  const { data: sourceQuote } = useQuote(quoteId || undefined);
  const { data: sourceJob } = useJob(jobId || undefined);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<{
    first_name: string;
    last_name: string;
    email?: string | null;
  } | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(addDays(new Date(), 30));
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0 },
  ]);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);

  // Pre-fill from quote
  useEffect(() => {
    if (sourceQuote) {
      setSelectedCustomerId(sourceQuote.customer_id);
      if (sourceQuote.customer) {
        setSelectedCustomer({
          first_name: sourceQuote.customer.first_name,
          last_name: sourceQuote.customer.last_name,
          email: sourceQuote.customer.email,
        });
      }
      setTaxRate(Number(sourceQuote.tax_rate) || 0);
      setDiscountAmount(Number(sourceQuote.discount_amount) || 0);
      setNotes(sourceQuote.notes || "");
      if (sourceQuote.quote_items.length > 0) {
        setItems(
          sourceQuote.quote_items.map((item) => ({
            id: crypto.randomUUID(),
            description: item.description,
            quantity: Number(item.quantity) || 1,
            unit_price: Number(item.unit_price) || 0,
          }))
        );
      }
    }
  }, [sourceQuote]);

  // Pre-fill from job
  useEffect(() => {
    if (sourceJob && !sourceQuote) {
      setSelectedCustomerId(sourceJob.customer_id);
      if (sourceJob.customer) {
        setSelectedCustomer({
          first_name: sourceJob.customer.first_name,
          last_name: sourceJob.customer.last_name,
          email: sourceJob.customer.email,
        });
      }
      // Add job as a line item
      setItems([
        {
          id: crypto.randomUUID(),
          description: sourceJob.title || `Job ${sourceJob.job_number}`,
          quantity: 1,
          unit_price: 0,
        },
      ]);
    }
  }, [sourceJob, sourceQuote]);

  // Pre-fill customer from URL param
  useEffect(() => {
    if (customerId && !quoteId && !jobId) {
      setSelectedCustomerId(customerId);
    }
  }, [customerId, quoteId, jobId]);

  const calculations = useInvoiceCalculations({
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
      const result = await createInvoice.mutateAsync({
        invoice: {
          business_id: business.id,
          customer_id: selectedCustomerId,
          job_id: jobId || null,
          quote_id: quoteId || null,
          due_date: dueDate?.toISOString().split("T")[0] || null,
          tax_rate: taxRate,
          discount_amount: discountAmount,
          notes: notes || null,
          internal_notes: internalNotes || null,
          subtotal: calculations.subtotal,
          tax_amount: calculations.taxAmount,
          total: calculations.total,
          balance_due: calculations.total,
          amount_paid: 0,
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
        setSavedInvoiceId(result.id);
        setSendDialogOpen(true);
      } else {
        toast({
          title: "Invoice created",
          description: `Invoice ${result.invoice_number} has been saved as draft.`,
        });
        navigate(`/invoices/${result.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canSend = selectedCustomerId && items.some((item) => item.description.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Invoice</h1>
          <p className="text-muted-foreground">
            Create a new invoice for a customer
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
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceDetailsForm
                dueDate={dueDate}
                onDueDateChange={setDueDate}
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
              <InvoiceLineItemsEditor items={items} onItemsChange={setItems} />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Summary */}
        <div>
          <InvoiceSummaryCard
            subtotal={calculations.subtotal}
            discountAmount={calculations.discountAmount}
            taxRate={taxRate}
            taxAmount={calculations.taxAmount}
            total={calculations.total}
            onSaveDraft={() => handleSave(false)}
            onSend={() => handleSave(true)}
            isSaving={createInvoice.isPending}
            canSend={canSend}
          />
        </div>
      </div>

      {savedInvoiceId && selectedCustomer && (
        <SendInvoiceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          invoiceId={savedInvoiceId}
          invoiceNumber="(new)"
          customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
          customerEmail={selectedCustomer.email}
          onSuccess={() => navigate(`/invoices/${savedInvoiceId}`)}
        />
      )}
    </div>
  );
}
