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
import { useRevokePortalAccess } from "@/hooks/useRevokePortalAccess";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface RevokePortalAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  businessId: string;
  onSuccess?: () => void;
}

export function RevokePortalAccessDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  businessId,
  onSuccess,
}: RevokePortalAccessDialogProps) {
  const { revokeAccess, isLoading } = useRevokePortalAccess();
  const { toast } = useToast();

  const handleRevoke = async () => {
    const result = await revokeAccess(customerId, businessId);

    if (result.success) {
      toast({
        title: "Access revoked",
        description: `Portal access has been revoked for ${customerName}`,
      });
      onOpenChange(false);
      onSuccess?.();
    } else {
      toast({
        title: "Failed to revoke access",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Revoke Portal Access
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to revoke portal access for{" "}
                <span className="font-medium text-foreground">{customerName}</span>?
              </p>
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <p>This will:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Log them out of all active sessions</li>
                  <li>Prevent them from accessing the portal</li>
                  <li>Remove their link to your business</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                You can re-invite them later if needed.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRevoke}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Revoking..." : "Revoke Access"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
