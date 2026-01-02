import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InvoiceDetailsFormProps {
  dueDate: Date | undefined;
  onDueDateChange: (date: Date | undefined) => void;
  taxRate: number;
  onTaxRateChange: (rate: number) => void;
  discountAmount: number;
  onDiscountAmountChange: (amount: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  internalNotes: string;
  onInternalNotesChange: (notes: string) => void;
}

export function InvoiceDetailsForm({
  dueDate,
  onDueDateChange,
  taxRate,
  onTaxRateChange,
  discountAmount,
  onDiscountAmountChange,
  notes,
  onNotesChange,
  internalNotes,
  onInternalNotesChange,
}: InvoiceDetailsFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="dueDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dueDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dueDate ? format(dueDate, "PPP") : "Select due date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={onDueDateChange}
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
            step="0.1"
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
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Payment terms, thank you message, etc."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNotes">Internal Notes (not visible to customer)</Label>
        <Textarea
          id="internalNotes"
          value={internalNotes}
          onChange={(e) => onInternalNotesChange(e.target.value)}
          placeholder="Notes for your team..."
          rows={2}
        />
      </div>
    </div>
  );
}
