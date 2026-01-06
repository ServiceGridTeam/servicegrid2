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
import { Mail, AlertCircle } from "lucide-react";
import { useSendPortalInvite } from "@/hooks/usePortalInvite";
import { useToast } from "@/hooks/use-toast";

interface SendPortalInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  businessId: string;
}

export function SendPortalInviteDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  businessId,
}: SendPortalInviteDialogProps) {
  const { sendInvite, isLoading } = useSendPortalInvite();
  const { toast } = useToast();

  const handleSend = async () => {
    if (!customerEmail) return;

    const result = await sendInvite({
      customerId,
      businessId,
      email: customerEmail,
      customerName,
    });

    if (result.success) {
      toast({
        title: "Portal invite sent",
        description: `Magic link sent to ${result.email}`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: "Failed to send invite",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  if (!customerEmail) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              No Email Address
            </AlertDialogTitle>
            <AlertDialogDescription>
              {customerName} doesn't have an email address on file. Please add
              an email address to their profile before sending a portal invite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Portal Invite
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                A magic link will be emailed to <strong>{customerName}</strong>{" "}
                to access their customer portal.
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Email:</span>{" "}
                {customerEmail}
              </p>
              <p className="text-sm text-muted-foreground">
                The link will expire in 15 minutes.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleSend} disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Invite"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
