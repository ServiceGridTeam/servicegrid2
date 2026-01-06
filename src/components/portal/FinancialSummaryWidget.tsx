import { Link } from 'react-router-dom';
import { DollarSign, TrendingUp, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePortalBasePath } from '@/hooks/usePortalBasePath';

interface FinancialSummaryWidgetProps {
  totalOwed: number;
  isLoading?: boolean;
}

export function FinancialSummaryWidget({ 
  totalOwed,
  isLoading 
}: FinancialSummaryWidgetProps) {
  const { buildPath } = usePortalBasePath();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Financial Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          Financial Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Owed */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Balance</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(totalOwed)}
                </p>
              </div>
            </div>
            
            {totalOwed > 0 && (
              <Button asChild size="sm">
                <Link to={buildPath('/documents?tab=invoices')}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </Link>
              </Button>
            )}
          </div>

          {totalOwed === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No outstanding balance
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default FinancialSummaryWidget;
