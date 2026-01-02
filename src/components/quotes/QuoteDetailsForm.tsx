import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface QuoteDetailsFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  validUntil: Date | undefined;
  onValidUntilChange: (date: Date | undefined) => void;
  taxRate: number;
  onTaxRateChange: (value: number) => void;
  discountAmount: number;
  onDiscountAmountChange: (value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  internalNotes: string;
  onInternalNotesChange: (value: string) => void;
}

export function QuoteDetailsForm({
  title,
  onTitleChange,
  validUntil,
  onValidUntilChange,
  taxRate,
  onTaxRateChange,
  discountAmount,
  onDiscountAmountChange,
  notes,
  onNotesChange,
  internalNotes,
  onInternalNotesChange,
}: QuoteDetailsFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Quote Title</Label>
        <Input
          id="title"
          placeholder="e.g., Lawn Care Service - Spring 2024"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valid Until</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !validUntil && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {validUntil ? format(validUntil, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={validUntil}
                onSelect={onValidUntilChange}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxRate">Tax Rate (%)</Label>
          <Input
            id="taxRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discount">Discount Amount ($)</Label>
        <Input
          id="discount"
          type="number"
          min="0"
          step="0.01"
          value={discountAmount}
          onChange={(e) => onDiscountAmountChange(parseFloat(e.target.value) || 0)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (visible to customer)</Label>
        <Textarea
          id="notes"
          placeholder="Add any notes that should be visible to the customer..."
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal Notes (team only)</Label>
        <Textarea
          id="internalNotes"
          placeholder="Add internal notes for your team..."
          value={internalNotes}
          onChange={(e) => onInternalNotesChange(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
