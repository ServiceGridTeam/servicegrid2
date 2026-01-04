import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStripeConnectStatus } from "@/hooks/useStripeConnect";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StripeReturn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: status, isLoading, error, refetch } = useStripeConnectStatus();

  useEffect(() => {
    // Refetch status on mount to get latest
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (status && !isLoading) {
      const timer = setTimeout(() => {
        if (status.onboarding_complete) {
          toast({
            title: "Stripe Connected",
            description: "Your payment processing is now active!",
          });
        } else if (status.status === "restricted") {
          toast({
            variant: "destructive",
            title: "Additional Information Required",
            description: "Please complete the remaining verification steps.",
          });
        } else {
          toast({
            title: "Setup In Progress",
            description: "Complete the onboarding process to start accepting payments.",
          });
        }
        navigate("/settings");
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [status, isLoading, navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying Your Account</h2>
            <p className="text-muted-foreground">
              Please wait while we confirm your Stripe setup...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verification Error</h2>
            <p className="text-muted-foreground">
              There was an issue verifying your Stripe account. Redirecting...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="pt-6 text-center">
          {status?.onboarding_complete ? (
            <>
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Setup Complete!</h2>
              <p className="text-muted-foreground">
                Your Stripe account is ready to accept payments.
              </p>
            </>
          ) : (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
              <h2 className="text-xl font-semibold mb-2">Processing...</h2>
              <p className="text-muted-foreground">
                Redirecting you back to settings...
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
