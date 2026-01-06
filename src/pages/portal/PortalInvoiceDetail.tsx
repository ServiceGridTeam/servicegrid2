import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, Receipt, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { InvoicePayment } from '@/components/portal/InvoicePayment';
import { getPortalContext } from '@/lib/portalLocalState';

export default function PortalInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const context = getPortalContext();

  const { data: invoice, isLoading, refetch } = useQuery({
    queryKey: ['portal-invoice', id],
    queryFn: async () => {
      if (!id) throw new Error('No invoice ID');
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (
            id,
            description,
            quantity,
            unit_price,
            total,
            sort_order
          )
        `)
        .eq('id', id)
        .eq('customer_id', context.activeCustomerId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!context.activeCustomerId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'default';
      case 'Sent':
        return 'secondary';
      case 'Overdue':
        return 'destructive';
      case 'Partial':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Invoice not found</p>
            <Button variant="link" onClick={() => navigate('/portal/documents')}>
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = invoice.invoice_items?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];
  const isPaid = invoice.status === 'Paid';
  const balanceDue = invoice.balance_due ?? invoice.total ?? 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          variant="ghost"
          onClick={() => navigate('/portal/documents')}
          className="mb-4 gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Documents
        </Button>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Invoice Details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-xl">{invoice.invoice_number}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {format(new Date(invoice.created_at), 'MMMM d, yyyy')}
                </p>
                {invoice.due_date && (
                  <p className="text-sm text-muted-foreground">
                    Due {format(new Date(invoice.due_date), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>
              <Badge variant={getStatusColor(invoice.status || 'Draft')} className="text-sm">
                {invoice.status}
              </Badge>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Line Items */}
              <div>
                <h3 className="font-medium mb-3">Items</h3>
                <div className="space-y-2">
                  {lineItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} × ${(item.unit_price || 0).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">
                        ${(item.total || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${(invoice.subtotal || 0).toFixed(2)}</span>
                </div>
                {invoice.discount_amount && invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-${invoice.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                {invoice.tax_amount && invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tax {invoice.tax_rate && `(${invoice.tax_rate}%)`}
                    </span>
                    <span>${invoice.tax_amount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${(invoice.total || 0).toFixed(2)}</span>
                </div>
                {invoice.amount_paid && invoice.amount_paid > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid</span>
                    <span>-${invoice.amount_paid.toFixed(2)}</span>
                  </div>
                )}
                {!isPaid && balanceDue > 0 && (
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Balance Due</span>
                    <span>${balanceDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium mb-2">Notes</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {invoice.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isPaid ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                  <Receipt className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
                  Paid
                </h3>
                {invoice.paid_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(invoice.paid_at), 'MMMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <InvoicePayment
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              amount={balanceDue}
              onSuccess={() => refetch()}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
