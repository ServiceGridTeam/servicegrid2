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
import { useSendInvoice } from "@/hooks/useInvoices";
import { useToast } from "@/hooks/use-toast";

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  onSuccess?: () => void;
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerName,
  customerEmail,
  onSuccess,
}: SendInvoiceDialogProps) {
  const { toast } = useToast();
  const sendInvoice = useSendInvoice();

  const handleSend = async () => {
    try {
      await sendInvoice.mutateAsync(invoiceId);
      toast({
        title: "Invoice sent",
        description: `Invoice ${invoiceNumber} has been marked as sent.`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send Invoice</AlertDialogTitle>
          <AlertDialogDescription>
            {customerEmail ? (
              <>
                Invoice {invoiceNumber} will be marked as sent to {customerName} ({customerEmail}).
              </>
            ) : (
              <>
                Invoice {invoiceNumber} will be marked as sent to {customerName}. 
                Note: This customer doesn't have an email address on file.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend}>
            Send Invoice
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
