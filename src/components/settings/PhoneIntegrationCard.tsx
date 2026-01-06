import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Phone, Key, Copy, Loader2, AlertTriangle, Clock, Activity } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  usePhoneIntegration,
  useGenerateApiKey,
  useRevokeApiKey,
  useUpdatePhonePermissions,
  PhoneIntegrationPermissions,
} from "@/hooks/usePhoneIntegration";
import { ApiKeyModal } from "./ApiKeyModal";

const PERMISSIONS_CONFIG: {
  key: keyof PhoneIntegrationPermissions;
  label: string;
  description: string;
}[] = [
  { key: "lookup_customer", label: "Customer Lookup", description: "Look up customer info by phone" },
  { key: "read_jobs", label: "Read Jobs", description: "View job details and history" },
  { key: "create_requests", label: "Create Requests", description: "Submit new job requests" },
  { key: "modify_jobs", label: "Modify Jobs", description: "Reschedule or cancel jobs" },
  { key: "read_pricing", label: "Read Pricing", description: "Access service pricing" },
  { key: "read_technician_eta", label: "Technician ETA", description: "Get live ETA updates" },
];

export function PhoneIntegrationCard() {
  const { data: integration, isLoading } = usePhoneIntegration();
  const generateKey = useGenerateApiKey();
  const revokeKey = useRevokeApiKey();
  const updatePermissions = useUpdatePhonePermissions();

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const handleGenerateKey = async () => {
    try {
      const key = await generateKey.mutateAsync();
      setGeneratedKey(key);
      setShowKeyModal(true);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRegenerateKey = async () => {
    setShowRegenerateDialog(false);
    try {
      const key = await generateKey.mutateAsync();
      setGeneratedKey(key);
      setShowKeyModal(true);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleRevokeKey = async () => {
    if (!integration) return;
    setShowRevokeDialog(false);
    try {
      await revokeKey.mutateAsync(integration.id);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handlePermissionChange = (key: keyof PhoneIntegrationPermissions, value: boolean) => {
    if (!integration) return;
    updatePermissions.mutate({
      integrationId: integration.id,
      permissions: { [key]: value },
    });
  };

  const copyKeyPrefix = () => {
    if (integration?.api_key_prefix) {
      navigator.clipboard.writeText(integration.api_key_prefix);
      toast.success("Key prefix copied");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">SG Phone Integration</CardTitle>
                <CardDescription>
                  Connect the AI Receptionist to your business
                </CardDescription>
              </div>
            </div>
            {integration && (
              <Badge variant="outline" className="border-green-500 text-green-600">
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!integration ? (
            // Empty state - no integration
            <div className="text-center py-6">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No API Key Configured</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                Generate an API key to connect SG Phone AI Receptionist to your ServiceGrid account.
              </p>
              <Button onClick={handleGenerateKey} disabled={generateKey.isPending}>
                {generateKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate API Key
              </Button>
            </div>
          ) : (
            // Active integration
            <>
              {/* API Key Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm">
                    {integration.api_key_prefix}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyKeyPrefix}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Used</p>
                    <p className="text-sm font-medium">
                      {integration.last_used_at
                        ? formatDistanceToNow(new Date(integration.last_used_at), { addSuffix: true })
                        : "Never"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Requests Today</p>
                    <p className="text-sm font-medium">{integration.request_count || 0}</p>
                  </div>
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Permissions</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERMISSIONS_CONFIG.map((perm) => (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="text-sm font-medium">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                      <Switch
                        checked={integration.permissions[perm.key]}
                        onCheckedChange={(checked) => handlePermissionChange(perm.key, checked)}
                        disabled={updatePermissions.isPending}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRegenerateDialog(true)}
                  disabled={generateKey.isPending}
                >
                  {generateKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Regenerate Key
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRevokeDialog(true)}
                  disabled={revokeKey.isPending}
                >
                  {revokeKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Revoke Access
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* API Key Modal */}
      <ApiKeyModal
        open={showKeyModal}
        apiKey={generatedKey}
        onClose={() => {
          setShowKeyModal(false);
          setGeneratedKey(null);
        }}
      />

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Regenerate API Key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the current API key. SG Phone will stop working until
              you update it with the new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateKey}>
              Regenerate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke API Access?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently disable the SG Phone integration. You'll need to generate a new
              API key and reconfigure SG Phone to reconnect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
