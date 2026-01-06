import { CreditCard, Trash2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { cn } from '@/lib/utils';

interface SavedPaymentMethodsProps {
  onAddNew?: () => void;
}

export function SavedPaymentMethods({ onAddNew }: SavedPaymentMethodsProps) {
  const {
    paymentMethods,
    isLoading,
    setDefault,
    isSettingDefault,
    remove,
    isRemoving,
  } = usePaymentMethods();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Payment Methods</CardTitle>
        {onAddNew && (
          <Button variant="outline" size="sm" onClick={onAddNew}>
            Add Card
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No saved payment methods</p>
            {onAddNew && (
              <Button variant="link" onClick={onAddNew} className="mt-2">
                Add a card
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  method.isDefault && 'border-primary bg-primary/5'
                )}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium capitalize">
                      {method.brand} •••• {method.last4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expires {method.expMonth}/{method.expYear}
                    </p>
                  </div>
                  {method.isDefault && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDefault(method.id)}
                      disabled={isSettingDefault}
                      title="Set as default"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(method.id)}
                    disabled={isRemoving}
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
