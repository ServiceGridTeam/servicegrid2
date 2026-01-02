import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSendQuote } from "@/hooks/useQuotes";
import { useToast } from "@/hooks/use-toast";

interface SendQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerEmail?: string | null;
  onSuccess?: () => void;
}

export function SendQuoteDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  customerName,
  customerEmail,
  onSuccess,
}: SendQuoteDialogProps) {
  const { toast } = useToast();
  const sendQuote = useSendQuote();

  const handleSend = async () => {
    try {
      await sendQuote.mutateAsync(quoteId);
      toast({
        title: "Quote sent",
        description: `Quote ${quoteNumber} has been marked as sent.`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Quote</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to send quote <strong>{quoteNumber}</strong> to{" "}
              <strong>{customerName}</strong>?
            </p>
            {customerEmail && (
              <p className="text-sm text-muted-foreground">
                Email: {customerEmail}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Note: This will mark the quote as sent. Email notifications will be
              available in a future update.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend}>
            {sendQuote.isPending ? "Sending..." : "Send Quote"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
