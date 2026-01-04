import { useState } from "react";
import { useInviteTeamMember } from "@/hooks/useTeamManagement";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Shield, Wrench, Eye } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type AppRole = Database["public"]["Enums"]["app_role"];

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emailSchema = z.string().email("Please enter a valid email address");

export function InviteMemberDialog({ open, onOpenChange }: InviteMemberDialogProps) {
  const { toast } = useToast();
  const inviteMember = useInviteTeamMember();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("technician");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    try {
      await inviteMember.mutateAsync({ email: email.trim().toLowerCase(), role });
      toast({
        title: "Invitation sent",
        description: `An invite has been sent to ${email}`,
      });
      handleClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("technician");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team. They'll receive an email with
              a link to create their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <span>
                        <span className="font-medium">Admin</span>
                        <span className="text-muted-foreground ml-1">
                          – Full access, can manage team
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value="technician">
                    <span className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-green-600" />
                      <span>
                        <span className="font-medium">Technician</span>
                        <span className="text-muted-foreground ml-1">
                          – Can manage jobs and customers
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-600" />
                      <span>
                        <span className="font-medium">Viewer</span>
                        <span className="text-muted-foreground ml-1">
                          – Read-only access
                        </span>
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={inviteMember.isPending || !email}>
              {inviteMember.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
