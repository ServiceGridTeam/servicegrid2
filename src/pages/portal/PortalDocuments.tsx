import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText, Receipt, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPortalContext } from '@/lib/portalLocalState';

export default function PortalDocuments() {
  const [tab, setTab] = useState<'quotes' | 'invoices'>('quotes');
  const navigate = useNavigate();
  const context = getPortalContext();

  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['portal-quotes', context.activeCustomerId, context.activeBusinessId],
    queryFn: async () => {
      if (!context.activeCustomerId || !context.activeBusinessId) return [];
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, total, created_at')
        .eq('customer_id', context.activeCustomerId)
        .eq('business_id', context.activeBusinessId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!context.activeCustomerId && !!context.activeBusinessId,
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['portal-invoices', context.activeCustomerId, context.activeBusinessId],
    queryFn: async () => {
      if (!context.activeCustomerId || !context.activeBusinessId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, balance_due, due_date, created_at')
        .eq('customer_id', context.activeCustomerId)
        .eq('business_id', context.activeBusinessId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!context.activeCustomerId && !!context.activeBusinessId,
  });

  const getQuoteStatusColor = (status: string) => {
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

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'default';
      case 'Sent':
        return 'secondary';
      case 'Overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Documents</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'quotes' | 'invoices')}>
        <TabsList className="mb-6">
          <TabsTrigger value="quotes" className="gap-2">
            <FileText className="h-4 w-4" />
            Quotes
            {quotes && quotes.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {quotes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
            {invoices && invoices.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {invoices.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes">
          {quotesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : quotes && quotes.length > 0 ? (
            <div className="space-y-3">
              {quotes.map((quote, index) => (
                <motion.div
                  key={quote.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/portal/quotes/${quote.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{quote.quote_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(quote.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">
                              ${(quote.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <Badge variant={getQuoteStatusColor(quote.status || 'Draft')}>
                              {quote.status}
                            </Badge>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No quotes yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          {invoicesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice, index) => (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link to={`/portal/invoices/${invoice.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <Receipt className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.due_date
                                ? `Due ${format(new Date(invoice.due_date), 'MMM d, yyyy')}`
                                : format(new Date(invoice.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">
                              ${(invoice.balance_due || invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <Badge variant={getInvoiceStatusColor(invoice.status || 'Draft')}>
                              {invoice.status}
                            </Badge>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No invoices yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
