import { useState, useEffect } from "react";
import { useBusiness, useUpdateBusiness } from "@/hooks/useBusiness";
import { useGeocodeAddress } from "@/hooks/useGeocoding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X, MapPin, Clock, Wrench } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface PhoneSettings {
  enabled: boolean;
  service_types: string[];
  service_area: {
    type: "none" | "radius";
    center?: { lat: number; lng: number };
    center_address?: string;
    radius_miles?: number;
    description?: string;
  };
  business_hours?: {
    timezone: string;
    schedule: Array<{
      day: string;
      enabled: boolean;
      start: string;
      end: string;
    }>;
  };
}

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
];

const DEFAULT_SCHEDULE = DAYS_OF_WEEK.map((day) => ({
  day,
  enabled: day !== "Saturday" && day !== "Sunday",
  start: "08:00",
  end: "17:00",
}));

const DEFAULT_SETTINGS: PhoneSettings = {
  enabled: true,
  service_types: [],
  service_area: { type: "none" },
  business_hours: {
    timezone: "America/New_York",
    schedule: DEFAULT_SCHEDULE,
  },
};

function parseSettings(settings: Json | null): PhoneSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return DEFAULT_SETTINGS;
  }
  const obj = settings as Record<string, Json>;
  const phoneIntegration = obj.phone_integration;
  if (!phoneIntegration || typeof phoneIntegration !== "object" || Array.isArray(phoneIntegration)) {
    return DEFAULT_SETTINGS;
  }
  const pi = phoneIntegration as Record<string, Json>;
  return {
    enabled: typeof pi.enabled === "boolean" ? pi.enabled : true,
    service_types: Array.isArray(pi.service_types) ? (pi.service_types as string[]) : [],
    service_area: pi.service_area && typeof pi.service_area === "object" && !Array.isArray(pi.service_area)
      ? (pi.service_area as PhoneSettings["service_area"])
      : { type: "none" },
    business_hours: pi.business_hours && typeof pi.business_hours === "object" && !Array.isArray(pi.business_hours)
      ? (pi.business_hours as PhoneSettings["business_hours"])
      : DEFAULT_SETTINGS.business_hours,
  };
}

export function PhoneSettingsForm() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { toast } = useToast();

  const [settings, setSettings] = useState<PhoneSettings>(DEFAULT_SETTINGS);
  const [newServiceType, setNewServiceType] = useState("");
  const [centerAddress, setCenterAddress] = useState("");

  const { data: geocodeResult, isLoading: isGeocoding } = useGeocodeAddress(
    settings.service_area.type === "radius" && centerAddress.length >= 5 ? centerAddress : undefined
  );

  useEffect(() => {
    if (business?.settings) {
      const parsed = parseSettings(business.settings);
      setSettings(parsed);
      if (parsed.service_area.center_address) {
        setCenterAddress(parsed.service_area.center_address);
      }
    }
  }, [business?.settings]);

  const handleSave = async () => {
    try {
      const currentSettings = business?.settings && typeof business.settings === "object" && !Array.isArray(business.settings)
        ? (business.settings as Record<string, Json>)
        : {};

      // Update center coordinates from geocode result if available
      const updatedServiceArea = { ...settings.service_area };
      if (settings.service_area.type === "radius" && geocodeResult) {
        updatedServiceArea.center = { lat: geocodeResult.latitude, lng: geocodeResult.longitude };
        updatedServiceArea.center_address = centerAddress;
      }

      const updatedSettings: Record<string, Json> = {
        ...currentSettings,
        phone_integration: {
          enabled: settings.enabled,
          service_types: settings.service_types,
          service_area: updatedServiceArea as unknown as Json,
          business_hours: settings.business_hours as unknown as Json,
        },
      };

      await updateBusiness.mutateAsync({ settings: updatedSettings });
      toast({ title: "Phone settings saved successfully" });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save settings",
        description: error.message,
      });
    }
  };

  const addServiceType = () => {
    const trimmed = newServiceType.trim();
    if (trimmed && !settings.service_types.includes(trimmed)) {
      setSettings((prev) => ({
        ...prev,
        service_types: [...prev.service_types, trimmed],
      }));
      setNewServiceType("");
    }
  };

  const removeServiceType = (type: string) => {
    setSettings((prev) => ({
      ...prev,
      service_types: prev.service_types.filter((t) => t !== type),
    }));
  };

  const useBusinessAddress = () => {
    if (business) {
      const addr = [business.address_line1, business.city, business.state, business.zip]
        .filter(Boolean)
        .join(", ");
      setCenterAddress(addr);
    }
  };

  const updateSchedule = (dayIndex: number, updates: Partial<{ enabled: boolean; start: string; end: string }>) => {
    setSettings((prev) => {
      const schedule = [...(prev.business_hours?.schedule || DEFAULT_SCHEDULE)];
      schedule[dayIndex] = { ...schedule[dayIndex], ...updates };
      return {
        ...prev,
        business_hours: {
          ...prev.business_hours!,
          schedule,
        },
      };
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Types
          </CardTitle>
          <CardDescription>
            Define the types of services your business offers. These will be available for callers to select.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.service_types.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1 pr-1">
                {type}
                <button
                  type="button"
                  onClick={() => removeServiceType(type)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.service_types.length === 0 && (
              <p className="text-sm text-muted-foreground">No service types configured</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add service type (e.g., HVAC Repair)"
              value={newServiceType}
              onChange={(e) => setNewServiceType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addServiceType())}
            />
            <Button type="button" variant="outline" onClick={addServiceType}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Area
          </CardTitle>
          <CardDescription>
            Define the geographic area where your business operates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Area Type:</Label>
            <Select
              value={settings.service_area.type}
              onValueChange={(value: "none" | "radius") =>
                setSettings((prev) => ({
                  ...prev,
                  service_area: { ...prev.service_area, type: value },
                }))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No restriction</SelectItem>
                <SelectItem value="radius">Radius from center</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.service_area.type === "radius" && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Center Address</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter center address"
                      value={centerAddress}
                      onChange={(e) => setCenterAddress(e.target.value)}
                    />
                    <Button type="button" variant="outline" onClick={useBusinessAddress}>
                      Use Business Address
                    </Button>
                  </div>
                  {isGeocoding && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Geocoding address...
                    </p>
                  )}
                  {geocodeResult && (
                    <p className="text-sm text-green-600">
                      ✓ Location found: {geocodeResult.formattedAddress || `${geocodeResult.latitude}, ${geocodeResult.longitude}`}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Service Radius: {settings.service_area.radius_miles || 25} miles</Label>
                  <Slider
                    value={[settings.service_area.radius_miles || 25]}
                    onValueChange={([value]) =>
                      setSettings((prev) => ({
                        ...prev,
                        service_area: { ...prev.service_area, radius_miles: value },
                      }))
                    }
                    min={5}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="e.g., We serve the greater Phoenix metro area including Scottsdale, Tempe, and Mesa"
                    value={settings.service_area.description || ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        service_area: { ...prev.service_area, description: e.target.value },
                      }))
                    }
                    rows={2}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Business Hours
          </CardTitle>
          <CardDescription>
            Set your operating hours. Calls outside these hours can receive after-hours messaging.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Timezone:</Label>
            <Select
              value={settings.business_hours?.timezone || "America/New_York"}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  business_hours: { ...prev.business_hours!, timezone: value },
                }))
              }
            >
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            {(settings.business_hours?.schedule || DEFAULT_SCHEDULE).map((day, index) => (
              <div key={day.day} className="flex items-center gap-4">
                <div className="w-28">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(checked) => updateSchedule(index, { enabled: checked })}
                  />
                </div>
                <span className="w-24 font-medium">{day.day}</span>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.start}
                      onChange={(e) => updateSchedule(index, { start: e.target.value })}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.end}
                      onChange={(e) => updateSchedule(index, { end: e.target.value })}
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground">Closed</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Phone Settings
        </Button>
      </div>
    </div>
  );
}
