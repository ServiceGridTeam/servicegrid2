import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerSelector } from "@/components/quotes/CustomerSelector";
import {
  InvoiceDetailsForm,
  InvoiceLineItemsEditor,
  InvoiceSummaryCard,
  SendInvoiceDialog,
  type InvoiceLineItem,
} from "@/components/invoices";
import { useInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import { useInvoiceCalculations } from "@/hooks/useInvoiceCalculations";
import { useToast } from "@/hooks/use-toast";

export default function InvoiceEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: invoice, isLoading } = useInvoice(id);
  const updateInvoice = useUpdateInvoice();

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<{
    first_name: string;
    last_name: string;
    email?: string | null;
  } | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Load invoice data
  useEffect(() => {
    if (invoice) {
      setSelectedCustomerId(invoice.customer_id);
      if (invoice.customer) {
        setSelectedCustomer({
          first_name: invoice.customer.first_name,
          last_name: invoice.customer.last_name,
          email: invoice.customer.email,
        });
      }
      setDueDate(invoice.due_date ? new Date(invoice.due_date) : undefined);
      setTaxRate(Number(invoice.tax_rate) || 0);
      setDiscountAmount(Number(invoice.discount_amount) || 0);
      setNotes(invoice.notes || "");
      setInternalNotes(invoice.internal_notes || "");
      if (invoice.invoice_items.length > 0) {
        setItems(
          invoice.invoice_items.map((item) => ({
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
    }
  }, [invoice]);

  const calculations = useInvoiceCalculations({
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
      await updateInvoice.mutateAsync({
        id,
        invoice: {
          customer_id: selectedCustomerId,
          due_date: dueDate?.toISOString().split("T")[0] || null,
          tax_rate: taxRate,
          discount_amount: discountAmount,
          notes: notes || null,
          internal_notes: internalNotes || null,
          subtotal: calculations.subtotal,
          tax_amount: calculations.taxAmount,
          total: calculations.total,
          balance_due: calculations.total - Number(invoice?.amount_paid || 0),
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
          title: "Invoice updated",
          description: "Your changes have been saved.",
        });
        navigate(`/invoices/${id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

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

  const canSend = selectedCustomerId && items.some((item) => item.description.trim());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit {invoice.invoice_number}
          </h1>
          <p className="text-muted-foreground">Update invoice details</p>
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
            amountPaid={Number(invoice.amount_paid || 0)}
            showPaymentInfo
            onSaveDraft={() => handleSave(false)}
            onSend={() => handleSave(true)}
            isSaving={updateInvoice.isPending}
            canSend={canSend && invoice.status === "draft"}
          />
        </div>
      </div>

      {selectedCustomer && (
        <SendInvoiceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          invoiceId={id!}
          invoiceNumber={invoice.invoice_number}
          customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
          customerEmail={selectedCustomer.email}
          onSuccess={() => navigate(`/invoices/${id}`)}
        />
      )}
    </div>
  );
}
