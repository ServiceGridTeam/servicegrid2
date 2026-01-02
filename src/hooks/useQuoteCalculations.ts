import { useMemo } from "react";

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface QuoteCalculationsInput {
  items: LineItem[];
  discountAmount?: number;
  taxRate?: number;
}

interface QuoteCalculations {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

export function useQuoteCalculations({
  items,
  discountAmount = 0,
  taxRate = 0,
}: QuoteCalculationsInput): QuoteCalculations {
  return useMemo(() => {
    // Calculate subtotal from line items
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
      return sum + lineTotal;
    }, 0);

    // Apply discount
    const effectiveDiscount = Math.min(discountAmount, subtotal);
    const taxableAmount = subtotal - effectiveDiscount;

    // Calculate tax
    const taxAmount = taxableAmount * (taxRate / 100);

    // Calculate total
    const total = taxableAmount + taxAmount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(effectiveDiscount * 100) / 100,
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [items, discountAmount, taxRate]);
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round((quantity || 0) * (unitPrice || 0) * 100) / 100;
}
