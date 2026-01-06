import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { QuoteActions } from '@/components/portal/QuoteActions';
import { getPortalContext } from '@/lib/portalLocalState';

export default function PortalQuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const context = getPortalContext();

  const { data: quote, isLoading, refetch } = useQuery({
    queryKey: ['portal-quote', id],
    queryFn: async () => {
      if (!id) throw new Error('No quote ID');
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          quote_items (
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
      case 'Approved':
        return 'default';
      case 'Sent':
        return 'secondary';
      case 'Declined':
        return 'destructive';
      case 'Edits Requested':
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

  if (!quote) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Quote not found</p>
            <Button variant="link" onClick={() => navigate('/portal/documents')}>
              Back to Documents
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lineItems = quote.quote_items?.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)) || [];

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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-xl">{quote.quote_number}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Created {format(new Date(quote.created_at), 'MMMM d, yyyy')}
              </p>
              {quote.valid_until && (
                <p className="text-sm text-muted-foreground">
                  Valid until {format(new Date(quote.valid_until), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
            <Badge variant={getStatusColor(quote.status || 'Draft')} className="text-sm">
              {quote.status}
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
                <span>${(quote.subtotal || 0).toFixed(2)}</span>
              </div>
              {quote.discount_amount && quote.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-${quote.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {quote.tax_amount && quote.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Tax {quote.tax_rate && `(${quote.tax_rate}%)`}
                  </span>
                  <span>${quote.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${(quote.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {quote.notes}
                  </p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <QuoteActions
              quoteId={quote.id}
              currentStatus={quote.status || 'Draft'}
              onActionComplete={() => refetch()}
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
