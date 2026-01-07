import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Mail, RefreshCw, Settings, Unlink, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useEmailConnections, useConnectGmail, useUpdateEmailConnection, useDisconnectEmail, useTriggerEmailSync, buildGoogleOAuthUrl, type EmailConnection } from "@/hooks/useEmailConnections";
import { formatDistanceToNow } from "date-fns";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function EmailConnectionCard() {
  const { data: connections, isLoading } = useEmailConnections();
  const connectGmail = useConnectGmail();
  const updateConnection = useUpdateEmailConnection();
  const disconnectEmail = useDisconnectEmail();
  const triggerSync = useTriggerEmailSync();

  const [showSettings, setShowSettings] = useState(false);
  const [oauthWindow, setOauthWindow] = useState<Window | null>(null);

  // Get active Gmail connection
  const gmailConnection = connections?.find(c => c.provider === "gmail" && c.is_active);

  // Handle OAuth callback
  const handleOAuthMessage = useCallback((event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data?.type === "gmail-oauth-callback" && event.data?.code) {
      const redirectUri = `${window.location.origin}/oauth/gmail/callback`;
      connectGmail.mutate({
        code: event.data.code,
        redirectUri,
      });
      oauthWindow?.close();
      setOauthWindow(null);
    }
  }, [connectGmail, oauthWindow]);

  useEffect(() => {
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [handleOAuthMessage]);

  const handleConnectGmail = () => {
    if (!GOOGLE_CLIENT_ID) {
      console.error("Google Client ID not configured");
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/gmail/callback`;
    const authUrl = buildGoogleOAuthUrl(redirectUri, GOOGLE_CLIENT_ID);
    
    // Open OAuth in popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      "gmail-oauth",
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    setOauthWindow(popup);
  };

  const handleSettingChange = (key: keyof EmailConnection, value: unknown) => {
    if (!gmailConnection) return;
    
    updateConnection.mutate({
      connectionId: gmailConnection.id,
      updates: { [key]: value },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Integration
        </CardTitle>
        <CardDescription>
          Connect your email to automatically create job requests from incoming service emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {gmailConnection ? (
          <>
            {/* Connected state */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-background">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{gmailConnection.email_address}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <HealthBadge health={gmailConnection.connection_health} />
                    {gmailConnection.last_sync_at && (
                      <span>
                        • Last sync {formatDistanceToNow(new Date(gmailConnection.last_sync_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerSync.mutate(gmailConnection.id)}
                  disabled={triggerSync.isPending}
                >
                  {triggerSync.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="space-y-6 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Classification Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[gmailConnection.classification_threshold * 100]}
                      onValueChange={([value]) => 
                        handleSettingChange("classification_threshold", value / 100)
                      }
                      min={50}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-12">
                      {Math.round(gmailConnection.classification_threshold * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only auto-create requests when AI confidence meets this threshold
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-create Requests</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically create job requests from high-confidence emails
                    </p>
                  </div>
                  <Switch
                    checked={gmailConnection.auto_create_requests}
                    onCheckedChange={(checked) => 
                      handleSettingChange("auto_create_requests", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-acknowledge</Label>
                    <p className="text-xs text-muted-foreground">
                      Send confirmation email when request is created
                    </p>
                  </div>
                  <Switch
                    checked={gmailConnection.auto_acknowledge}
                    onCheckedChange={(checked) => 
                      handleSettingChange("auto_acknowledge", checked)
                    }
                  />
                </div>

                <div className="pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect Email
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Email?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your email data will be retained for 30 days. You can reconnect anytime.
                          Pending requests from this email will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnectEmail.mutate(gmailConnection.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Not connected state */}
            <div className="text-center py-6">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">Connect your email</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect Gmail to automatically classify and convert service emails into job requests
              </p>
              <Button
                onClick={handleConnectGmail}
                disabled={connectGmail.isPending || !GOOGLE_CLIENT_ID}
              >
                {connectGmail.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Connect Gmail
              </Button>
              {!GOOGLE_CLIENT_ID && (
                <p className="text-xs text-destructive mt-2">
                  Google OAuth not configured
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health }: { health: EmailConnection["connection_health"] }) {
  if (health === "healthy") {
    return (
      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Connected
      </Badge>
    );
  }

  if (health === "warning") {
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
        <AlertCircle className="h-3 w-3 mr-1" />
        Sync issues
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
      <AlertCircle className="h-3 w-3 mr-1" />
      Error
    </Badge>
  );
}
