import { useMemo } from "react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface UseInvoiceCalculationsProps {
  items: LineItem[];
  discountAmount: number;
  taxRate: number;
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function useInvoiceCalculations({
  items,
  discountAmount,
  taxRate,
}: UseInvoiceCalculationsProps) {
  return useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + calculateLineTotal(item.quantity, item.unit_price),
      0
    );

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      total,
    };
  }, [items, discountAmount, taxRate]);
}
