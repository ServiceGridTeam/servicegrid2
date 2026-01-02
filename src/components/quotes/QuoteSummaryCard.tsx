import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Send, Save } from "lucide-react";

interface QuoteSummaryCardProps {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  onSaveDraft: () => void;
  onSend: () => void;
  isSaving: boolean;
  canSend: boolean;
}

export function QuoteSummaryCard({
  subtotal,
  discountAmount,
  taxRate,
  taxAmount,
  total,
  onSaveDraft,
  onSend,
  isSaving,
  canSend,
}: QuoteSummaryCardProps) {
  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-lg">Quote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-green-600">-${discountAmount.toFixed(2)}</span>
          </div>
        )}
        
        {taxRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax ({taxRate}%)</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
        )}
        
        <Separator />
        
        <div className="flex justify-between font-semibold text-lg">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={onSaveDraft}
          disabled={isSaving}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Draft"}
        </Button>
        <Button
          className="w-full"
          onClick={onSend}
          disabled={isSaving || !canSend}
        >
          <Send className="mr-2 h-4 w-4" />
          Send Quote
        </Button>
      </CardFooter>
    </Card>
  );
}
