import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Receipt, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActionItemsWidgetProps {
  pendingQuotes: number;
  unpaidInvoices: number;
  isLoading?: boolean;
}

export function ActionItemsWidget({ 
  pendingQuotes, 
  unpaidInvoices,
  isLoading 
}: ActionItemsWidgetProps) {
  const hasItems = pendingQuotes > 0 || unpaidInvoices > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Action Required</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
            <div className="h-12 bg-muted animate-pulse rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasItems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Action Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            You're all caught up! No pending actions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Action Required</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingQuotes > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Link 
              to="/portal/documents?tab=quotes"
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pending Quotes</p>
                  <p className="text-xs text-muted-foreground">Review and approve</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  {pendingQuotes}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          </motion.div>
        )}

        {unpaidInvoices > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <Link 
              to="/portal/documents?tab=invoices"
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Unpaid Invoices</p>
                  <p className="text-xs text-muted-foreground">Pay online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  {unpaidInvoices}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActionItemsWidget;
