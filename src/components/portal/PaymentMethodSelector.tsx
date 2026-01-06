import { CreditCard } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/lib/portalApi';

interface PaymentMethodSelectorProps {
  methods: PaymentMethod[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

const brandIcons: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  amex: '💳',
  discover: '💳',
};

export function PaymentMethodSelector({
  methods,
  selectedId,
  onSelect,
}: PaymentMethodSelectorProps) {
  if (methods.length === 0) {
    return null;
  }

  const defaultMethod = methods.find((m) => m.isDefault);
  const effectiveSelectedId = selectedId || defaultMethod?.id;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Payment Method</Label>
      <RadioGroup
        value={effectiveSelectedId}
        onValueChange={(value) => onSelect(value)}
        className="grid gap-2"
      >
        {methods.map((method) => (
          <div key={method.id}>
            <RadioGroupItem
              value={method.id}
              id={method.id}
              className="peer sr-only"
            />
            <Label
              htmlFor={method.id}
              className={cn(
                'flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                'peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'
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
              </div>
              {method.isDefault && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Default
                </span>
              )}
            </Label>
          </div>
        ))}

        {/* Option to use new card */}
        <div>
          <RadioGroupItem
            value="new"
            id="new-card"
            className="peer sr-only"
          />
          <Label
            htmlFor="new-card"
            className={cn(
              'flex items-center gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
              'peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'
            )}
          >
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <p className="font-medium">Use a different card</p>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
