import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalStatusBadge } from "./PortalStatusBadge";
import { RevokePortalAccessDialog } from "./RevokePortalAccessDialog";
import { usePortalInviteHistory } from "@/hooks/usePortalInviteHistory";
import { useSingleCustomerPortalStatus } from "@/hooks/useCustomerPortalStatus";
import { useSendPortalInvite } from "@/hooks/usePortalInvite";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Send, History, CheckCircle, Clock, XCircle, Mail, User, Calendar, ShieldX } from "lucide-react";

interface PortalInviteHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  businessId: string;
}

export function PortalInviteHistoryDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerEmail,
  businessId,
}: PortalInviteHistoryDialogProps) {
  const { data: status, isLoading: statusLoading } = useSingleCustomerPortalStatus(customerId);
  const { data: invites, isLoading: invitesLoading } = usePortalInviteHistory(customerId);
  const { sendInvite, isLoading: sendingInvite } = useSendPortalInvite();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const handleResendInvite = async () => {
    if (!customerEmail) {
      toast({
        title: "No email address",
        description: "This customer doesn't have an email address.",
        variant: "destructive",
      });
      return;
    }

    const result = await sendInvite({
      customerId,
      businessId,
      email: customerEmail,
      customerName,
    });

    if (result.success) {
      toast({
        title: "Invite sent",
        description: `Magic link sent to ${result.email}`,
      });
      queryClient.invalidateQueries({ queryKey: ["portal-invite-history", customerId] });
      queryClient.invalidateQueries({ queryKey: ["customer-portal-status"] });
      queryClient.invalidateQueries({ queryKey: ["customer-portal-status-single", customerId] });
    } else {
      toast({
        title: "Failed to send invite",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const getInviteStatusBadge = (invite: { status: string; expires_at: string; accepted_at: string | null }) => {
    if (invite.status === "accepted" || invite.accepted_at) {
      return (
        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
          <CheckCircle className="mr-1 h-3 w-3" />
          Accepted
        </Badge>
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="mr-1 h-3 w-3" />
          Expired
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Portal Access for {customerName}
          </DialogTitle>
          <DialogDescription>
            View invite history and manage portal access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium">Current Status</p>
              {statusLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : status ? (
                <PortalStatusBadge
                  hasPortalAccess={status.hasPortalAccess}
                  pendingInvite={status.pendingInvite}
                />
              ) : null}
            </div>
            {status?.hasPortalAccess && status.accountEmail && (
              <div className="text-right text-sm">
                <p className="text-muted-foreground">Account Email</p>
                <p className="font-medium">{status.accountEmail}</p>
                {status.lastLogin && (
                  <p className="text-xs text-muted-foreground">
                    Last login: {formatDistanceToNow(new Date(status.lastLogin), { addSuffix: true })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Invite History */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Invite History
            </h4>
            
            {invitesLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : invites && invites.length > 0 ? (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{invite.email}</span>
                      </div>
                      {getInviteStatusBadge(invite)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {invite.sent_at
                          ? format(new Date(invite.sent_at), "MMM d, yyyy 'at' h:mm a")
                          : format(new Date(invite.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      {invite.created_by_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {invite.created_by_name}
                        </span>
                      )}
                    </div>
                    {invite.accepted_at && (
                      <p className="text-xs text-green-600">
                        Accepted on {format(new Date(invite.accepted_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No invites sent yet
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-2 border-t">
            <div>
              {status?.hasPortalAccess && (
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setRevokeDialogOpen(true)}
                >
                  <ShieldX className="mr-2 h-4 w-4" />
                  Revoke Access
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={handleResendInvite}
                disabled={sendingInvite || !customerEmail}
              >
                <Send className="mr-2 h-4 w-4" />
                {sendingInvite ? "Sending..." : status?.hasPortalAccess ? "Send New Link" : "Send Invite"}
              </Button>
            </div>
          </div>
        </div>

        <RevokePortalAccessDialog
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
          customerId={customerId}
          customerName={customerName}
          businessId={businessId}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
