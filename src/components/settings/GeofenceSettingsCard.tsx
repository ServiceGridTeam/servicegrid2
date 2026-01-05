import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBusiness, useUpdateBusiness } from "@/hooks/useBusiness";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Shield, Camera, FileText } from "lucide-react";

export function GeofenceSettingsCard() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { toast } = useToast();

  const [settings, setSettings] = useState({
    default_geofence_radius_meters: 150,
    geofence_enforcement_mode: "warn",
    geofence_allow_override: true,
    geofence_override_requires_reason: true,
    geofence_override_requires_photo: false,
  });

  useEffect(() => {
    if (business) {
      setSettings({
        default_geofence_radius_meters: business.default_geofence_radius_meters || 150,
        geofence_enforcement_mode: business.geofence_enforcement_mode || "warn",
        geofence_allow_override: business.geofence_allow_override ?? true,
        geofence_override_requires_reason: business.geofence_override_requires_reason ?? true,
        geofence_override_requires_photo: business.geofence_override_requires_photo ?? false,
      });
    }
  }, [business]);

  const handleSave = async () => {
    try {
      await updateBusiness.mutateAsync(settings);
      toast({ title: "Geofence settings saved" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: error.message,
      });
    }
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
          <MapPin className="h-5 w-5" />
          Geofence Settings
        </CardTitle>
        <CardDescription>
          Configure location-based clock-in/out verification for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default Radius */}
        <div className="space-y-2">
          <Label htmlFor="radius" className="flex items-center gap-2">
            Default Geofence Radius
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="radius"
              type="number"
              min={50}
              max={1000}
              step={10}
              value={settings.default_geofence_radius_meters}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_geofence_radius_meters: parseInt(e.target.value) || 150,
                })
              }
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">meters</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Workers must be within this distance of the job site to clock in/out (50-1000m)
          </p>
        </div>

        {/* Enforcement Mode */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Enforcement Mode
          </Label>
          <Select
            value={settings.geofence_enforcement_mode}
            onValueChange={(value) =>
              setSettings({ ...settings, geofence_enforcement_mode: value })
            }
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">
                <div className="flex flex-col">
                  <span>Off</span>
                  <span className="text-xs text-muted-foreground">No location verification</span>
                </div>
              </SelectItem>
              <SelectItem value="warn">
                <div className="flex flex-col">
                  <span>Warn Only</span>
                  <span className="text-xs text-muted-foreground">Allow clock-in but flag for review</span>
                </div>
              </SelectItem>
              <SelectItem value="strict">
                <div className="flex flex-col">
                  <span>Strict</span>
                  <span className="text-xs text-muted-foreground">Block clock-in outside geofence</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Override Settings */}
        {settings.geofence_enforcement_mode !== "off" && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-medium">Override Settings</h4>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  Allow Override
                </Label>
                <p className="text-xs text-muted-foreground">
                  Let workers override geofence when outside the zone
                </p>
              </div>
              <Switch
                checked={settings.geofence_allow_override}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, geofence_allow_override: checked })
                }
              />
            </div>

            {settings.geofence_allow_override && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Require Reason
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Worker must explain why they're clocking in outside the zone
                    </p>
                  </div>
                  <Switch
                    checked={settings.geofence_override_requires_reason}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        geofence_override_requires_reason: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Camera className="h-4 w-4" />
                      Require Photo
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Worker must take a photo when overriding
                    </p>
                  </div>
                  <Switch
                    checked={settings.geofence_override_requires_photo}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        geofence_override_requires_photo: checked,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save Geofence Settings
        </Button>
      </CardContent>
    </Card>
  );
}
