import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * OAuth callback handler page.
 * Receives the authorization code from Google OAuth and posts it to the parent window.
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (window.opener) {
      if (code) {
        window.opener.postMessage(
          { type: "gmail-oauth-callback", code },
          window.location.origin
        );
      } else if (error) {
        window.opener.postMessage(
          { type: "gmail-oauth-error", error },
          window.location.origin
        );
      }
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}
