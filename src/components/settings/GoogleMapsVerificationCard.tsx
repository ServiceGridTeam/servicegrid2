import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFullVerification } from "@/hooks/useGoogleMapsVerification";
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  MapPin, 
  Server, 
  Monitor,
  AlertTriangle,
  ExternalLink
} from "lucide-react";

function StatusIndicator({ 
  configured, 
  working, 
  loading,
  error 
}: { 
  configured: boolean; 
  working?: boolean;
  loading?: boolean;
  error?: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Testing connection...</span>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        <span>Not configured</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        <span className="line-clamp-1">{error}</span>
      </div>
    );
  }

  if (working === false) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        <span>Connection failed</span>
      </div>
    );
  }

  if (working === true) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
        <CheckCircle className="h-4 w-4" />
        <span>Connected and working</span>
      </div>
    );
  }

  // Configured but not yet tested
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <AlertTriangle className="h-4 w-4" />
      <span>Configured (not tested)</span>
    </div>
  );
}

export function GoogleMapsVerificationCard() {
  const { result, isLoading, refetch } = useFullVerification();

  const handleTestConnection = () => {
    refetch();
  };

  const frontendConfigured = result.frontend.configured;
  const backendConfigured = result.backend?.configured ?? false;
  const backendWorking = result.backend?.working;
  const backendError = result.backend?.error || result.backendError;

  const allWorking = frontendConfigured && backendWorking === true;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle>Google Maps</CardTitle>
          </div>
          {allWorking && (
            <span className="text-xs font-medium text-green-600 dark:text-green-500 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
              Connected
            </span>
          )}
        </div>
        <CardDescription>
          Required for route optimization, maps display, and address geocoding
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Frontend Key Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            Frontend (Maps Display)
          </div>
          <div className="ml-6">
            <StatusIndicator 
              configured={frontendConfigured} 
              working={frontendConfigured ? true : undefined}
            />
            {result.frontend.keyValue && (
              <p className="text-xs text-muted-foreground mt-1">
                Key: {result.frontend.keyValue}
              </p>
            )}
          </div>
        </div>

        {/* Backend Key Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Server className="h-4 w-4 text-muted-foreground" />
            Backend (Geocoding & Routing)
          </div>
          <div className="ml-6">
            <StatusIndicator 
              configured={backendConfigured}
              working={backendWorking}
              loading={isLoading}
              error={backendError}
            />
            {result.backend?.apisTestedSuccessfully && (
              <p className="text-xs text-muted-foreground mt-1">
                Verified: {result.backend.apisTestedSuccessfully.join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Error Details */}
        {backendError && !isLoading && (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <p className="font-medium mb-1">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Ensure the API key is valid and not restricted</li>
                <li>Enable "Geocoding API" in Google Cloud Console</li>
                <li>Enable "Directions API" for route optimization</li>
                <li>Check billing is enabled on your Google Cloud project</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Not Configured Warning */}
        {(!frontendConfigured || !backendConfigured) && !isLoading && (
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {!frontendConfigured && !backendConfigured ? (
                "Google Maps API keys are not configured. Maps and route features will not work."
              ) : !frontendConfigured ? (
                "Frontend key (VITE_GOOGLE_MAPS_API_KEY) is not configured. Maps will not display."
              ) : (
                "Backend key (GOOGLE_MAPS_API_KEY) is not configured. Geocoding and routing will not work."
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleTestConnection}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a 
              href="https://console.cloud.google.com/apis/credentials" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Google Cloud Console
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
