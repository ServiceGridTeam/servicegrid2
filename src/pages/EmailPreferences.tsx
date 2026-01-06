import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Check, Mail, Megaphone, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  usePublicEmailPreferences,
  useUpdateEmailPreferences,
  useUnsubscribeAll,
} from "@/hooks/usePublicEmailPreferences";

export default function EmailPreferences() {
  const { token } = useParams<{ token: string }>();
  const { data: preferences, isLoading, error } = usePublicEmailPreferences(token);
  const updatePreferences = useUpdateEmailPreferences();
  const unsubscribeAll = useUnsubscribeAll();
  const [showSuccess, setShowSuccess] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto bg-destructive/10 text-destructive w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <CardTitle>Invalid or Expired Link</CardTitle>
            <CardDescription>
              This email preferences link is no longer valid. Please contact the business directly
              to manage your email preferences.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isUnsubscribed = !preferences.subscribed_marketing && !preferences.subscribed_sequences;
  const customerEmail = preferences.customer?.email || "your email";
  const businessName = preferences.business?.name || "this business";

  const handleToggle = async (field: "subscribed_marketing" | "subscribed_sequences", value: boolean) => {
    if (!token) return;
    await updatePreferences.mutateAsync({
      token,
      preferences: { [field]: value },
    });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleUnsubscribeAll = async () => {
    if (!token) return;
    await unsubscribeAll.mutateAsync({ token, reason: "user_request" });
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          {preferences.business?.logo_url ? (
            <img
              src={preferences.business.logo_url}
              alt={businessName}
              className="h-12 w-auto mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="mx-auto bg-primary/10 text-primary w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Mail className="h-6 w-6" />
            </div>
          )}
          <CardTitle>Email Preferences</CardTitle>
          <CardDescription>
            Manage your email preferences for <span className="font-medium">{customerEmail}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {showSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-300">
              <Check className="h-4 w-4" />
              <span className="text-sm">Your preferences have been saved</span>
            </div>
          )}

          {/* Transactional Emails - Always on */}
          <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex gap-3">
              <div className="bg-primary/10 text-primary w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <Label className="font-medium">Transactional Emails</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Appointment confirmations, invoices, and receipts
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground font-medium">Required</div>
          </div>

          {/* Marketing Emails */}
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
            <div className="flex gap-3">
              <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <Label htmlFor="marketing" className="font-medium">Promotional Emails</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Seasonal specials, discounts, and exclusive offers
                </p>
              </div>
            </div>
            <Switch
              id="marketing"
              checked={preferences.subscribed_marketing || false}
              onCheckedChange={(checked) => handleToggle("subscribed_marketing", checked)}
              disabled={updatePreferences.isPending}
            />
          </div>

          {/* Sequence Emails */}
          <div className="flex items-start justify-between gap-4 p-4 border rounded-lg">
            <div className="flex gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <Label htmlFor="sequences" className="font-medium">Follow-up Emails</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Tips, reminders, and helpful follow-ups after your service
                </p>
              </div>
            </div>
            <Switch
              id="sequences"
              checked={preferences.subscribed_sequences || false}
              onCheckedChange={(checked) => handleToggle("subscribed_sequences", checked)}
              disabled={updatePreferences.isPending}
            />
          </div>

          <Separator />

          {/* Unsubscribe All */}
          <div className="text-center space-y-3">
            {isUnsubscribed ? (
              <p className="text-sm text-muted-foreground">
                You are currently unsubscribed from all marketing emails.
                <br />
                You will still receive important transactional emails.
              </p>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                    Unsubscribe from all marketing emails
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unsubscribe from all?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll stop receiving promotional emails and follow-up sequences from{" "}
                      {businessName}. You'll still receive important transactional emails like
                      appointment confirmations and invoices.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleUnsubscribeAll}
                      disabled={unsubscribeAll.isPending}
                    >
                      Unsubscribe from all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Powered by {businessName}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
