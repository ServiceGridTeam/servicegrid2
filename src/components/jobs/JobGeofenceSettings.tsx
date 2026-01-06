import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown } from "lucide-react";
import { useState } from "react";
import { UseFormReturn } from "react-hook-form";

interface JobGeofenceSettingsProps {
  form: UseFormReturn<any>;
  businessDefaults?: {
    default_geofence_radius_meters?: number | null;
    geofence_enforcement_mode?: string | null;
  };
}

const radiusOptions = [
  { value: "50", label: "50 meters (~165 ft)" },
  { value: "100", label: "100 meters (~330 ft)" },
  { value: "150", label: "150 meters (~490 ft) - Default" },
  { value: "200", label: "200 meters (~660 ft)" },
  { value: "300", label: "300 meters (~985 ft)" },
  { value: "500", label: "500 meters (~1640 ft)" },
];

const enforcementOptions = [
  { value: "inherit", label: "Use business default" },
  { value: "off", label: "Off - No geofence check" },
  { value: "warn", label: "Warn - Allow with warning" },
  { value: "strict", label: "Strict - Require override" },
];

export function JobGeofenceSettings({ form, businessDefaults }: JobGeofenceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultRadiusLabel = businessDefaults?.default_geofence_radius_meters
    ? `${businessDefaults.default_geofence_radius_meters}m`
    : "150m";

  const defaultEnforcementLabel = businessDefaults?.geofence_enforcement_mode || "warn";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" type="button" className="w-full justify-between px-0 hover:bg-transparent">
          <span className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" />
            Geofence Settings
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Override business defaults for this specific job. Leave as default to use business settings 
          ({defaultRadiusLabel} radius, {defaultEnforcementLabel} mode).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="geofence_radius_meters"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Geofence Radius</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Use business default" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="inherit">Use business default</SelectItem>
                    {radiusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Distance from job location where clock-in is valid
                </FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="geofence_enforcement"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enforcement Mode</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Use business default" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {enforcementOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  How strictly to enforce the geofence boundary
                </FormDescription>
              </FormItem>
            )}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
