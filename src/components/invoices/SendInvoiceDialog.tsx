import { useState } from "react";
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
import { Mail, AlertCircle } from "lucide-react";

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
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      const result = await sendInvoice.mutateAsync(invoiceId);
      
      if (result.email_sent) {
        toast({
          title: "Invoice sent",
          description: `Invoice ${invoiceNumber} has been emailed to ${customerEmail}.`,
        });
      } else {
        toast({
          title: "Invoice marked as sent",
          description: result.reason || `Invoice ${invoiceNumber} has been marked as sent. No email was sent.`,
        });
      }
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Invoice
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            {customerEmail ? (
              <div className="space-y-2">
                <p>
                  Invoice <strong>{invoiceNumber}</strong> will be emailed to{" "}
                  <strong>{customerName}</strong>.
                </p>
                <p className="text-sm text-muted-foreground">
                  Email: {customerEmail}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">No email address on file</p>
                    <p className="text-amber-700 dark:text-amber-300">
                      This customer doesn't have an email address. The invoice will be marked as sent but no email will be delivered.
                    </p>
                  </div>
                </div>
                <p>
                  Invoice <strong>{invoiceNumber}</strong> will be marked as sent to{" "}
                  <strong>{customerName}</strong>.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={isSending}>
            {isSending ? "Sending..." : customerEmail ? "Send Email" : "Mark as Sent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
