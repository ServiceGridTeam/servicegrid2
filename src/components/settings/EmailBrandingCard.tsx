import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useBusiness, useUpdateBusiness } from "@/hooks/useBusiness";
import { Loader2, Mail, Palette } from "lucide-react";

interface EmailBranding {
  header_logo_url?: string;
  header_color?: string;
  button_color?: string;
  footer_text?: string;
  physical_address?: string;
  default_from_name?: string;
}

export function EmailBrandingCard() {
  const { data: business, isLoading } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const { toast } = useToast();

  const [branding, setBranding] = useState<EmailBranding>({
    header_logo_url: "",
    header_color: "#2563eb",
    button_color: "#059669",
    footer_text: "",
    physical_address: "",
    default_from_name: "",
  });

  useEffect(() => {
    if (business?.settings && typeof business.settings === "object") {
      const settings = business.settings as { email_branding?: EmailBranding };
      if (settings.email_branding) {
        setBranding({
          header_logo_url: settings.email_branding.header_logo_url || "",
          header_color: settings.email_branding.header_color || "#2563eb",
          button_color: settings.email_branding.button_color || "#059669",
          footer_text: settings.email_branding.footer_text || "",
          physical_address: settings.email_branding.physical_address || "",
          default_from_name: settings.email_branding.default_from_name || "",
        });
      }
    }
  }, [business]);

  const handleSave = async () => {
    try {
      const currentSettings = (business?.settings as Record<string, unknown>) || {};
      const updatedSettings = {
        ...currentSettings,
        email_branding: branding as unknown as Record<string, unknown>,
      };
      await updateBusiness.mutateAsync({
        settings: updatedSettings as unknown as import("@/integrations/supabase/types").Json,
      });
      toast({ title: "Email branding saved successfully" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        variant: "destructive",
        title: "Failed to save branding",
        description: message,
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
          <Mail className="h-5 w-5" />
          Email Branding
        </CardTitle>
        <CardDescription>
          Customize the look and feel of your marketing and transactional emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="from_name">Default From Name</Label>
          <Input
            id="from_name"
            placeholder={business?.name || "Your Business Name"}
            value={branding.default_from_name}
            onChange={(e) => setBranding({ ...branding, default_from_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            This name will appear in the "From" field of your emails
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="header_logo">Header Logo URL</Label>
          <Input
            id="header_logo"
            type="url"
            placeholder="https://..."
            value={branding.header_logo_url}
            onChange={(e) => setBranding({ ...branding, header_logo_url: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="header_color" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Header Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="header_color"
                type="color"
                value={branding.header_color}
                onChange={(e) => setBranding({ ...branding, header_color: e.target.value })}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.header_color}
                onChange={(e) => setBranding({ ...branding, header_color: e.target.value })}
                placeholder="#2563eb"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="button_color" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Button Color
            </Label>
            <div className="flex gap-2">
              <Input
                id="button_color"
                type="color"
                value={branding.button_color}
                onChange={(e) => setBranding({ ...branding, button_color: e.target.value })}
                className="w-12 h-10 p-1 cursor-pointer"
              />
              <Input
                value={branding.button_color}
                onChange={(e) => setBranding({ ...branding, button_color: e.target.value })}
                placeholder="#059669"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* Color Preview */}
        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Preview</p>
          <div className="space-y-2">
            <div
              className="h-12 rounded flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: branding.header_color || "#2563eb" }}
            >
              Email Header
            </div>
            <div className="flex justify-center">
              <button
                className="px-4 py-2 rounded text-white text-sm font-medium"
                style={{ backgroundColor: branding.button_color || "#059669" }}
              >
                Call to Action
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="physical_address">Physical Address</Label>
          <Input
            id="physical_address"
            placeholder="123 Main St, City, State 12345"
            value={branding.physical_address}
            onChange={(e) => setBranding({ ...branding, physical_address: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Required by CAN-SPAM for marketing emails
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="footer_text">Footer Text</Label>
          <Textarea
            id="footer_text"
            placeholder="© 2026 Your Business. All rights reserved."
            value={branding.footer_text}
            onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })}
            rows={2}
          />
        </div>

        <Button onClick={handleSave} disabled={updateBusiness.isPending}>
          {updateBusiness.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Branding Settings
        </Button>
      </CardContent>
    </Card>
  );
}
