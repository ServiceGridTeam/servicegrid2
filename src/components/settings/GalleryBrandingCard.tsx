/**
 * Gallery Branding Card
 * Editor for customizing public gallery appearance (colors, fonts, logo, content)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Palette,
  Image,
  Type,
  FileText,
  Eye,
  Loader2,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useGalleryBranding, DEFAULT_BRANDING, FONT_OPTIONS, HEADING_FONT_OPTIONS } from '@/hooks/useGalleryBranding';
import { useGallerySharingSettings } from '@/hooks/useGallerySharingSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LocalBranding {
  logo_url: string;
  background_image_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  gallery_title_template: string;
  footer_text: string;
  contact_info: string;
  show_powered_by: boolean;
  show_job_details: boolean;
  show_date: boolean;
  show_address: boolean;
}

const isValidHexColor = (color: string) => /^#[0-9A-Fa-f]{6}$/.test(color);

export function GalleryBrandingCard() {
  const { settings: sharingSettings, isLoading: settingsLoading } = useGallerySharingSettings();
  const { branding, isLoading, updateBranding, isUpdating, resetToDefaults, isResetting } = useGalleryBranding();
  const { toast } = useToast();

  const [local, setLocal] = useState<LocalBranding>({
    logo_url: '',
    background_image_url: '',
    favicon_url: '',
    primary_color: DEFAULT_BRANDING.primary_color,
    secondary_color: DEFAULT_BRANDING.secondary_color,
    background_color: DEFAULT_BRANDING.background_color || '#ffffff',
    text_color: DEFAULT_BRANDING.text_color || '#1e293b',
    heading_font: DEFAULT_BRANDING.heading_font || 'Inter',
    body_font: DEFAULT_BRANDING.body_font || 'Inter',
    gallery_title_template: DEFAULT_BRANDING.gallery_title_template || '',
    footer_text: '',
    contact_info: '',
    show_powered_by: true,
    show_job_details: true,
    show_date: true,
    show_address: false,
  });

  // Sync local state with branding data
  useEffect(() => {
    if (branding) {
      setLocal({
        logo_url: branding.logo_url || '',
        background_image_url: branding.background_image_url || '',
        favicon_url: branding.favicon_url || '',
        primary_color: branding.primary_color || DEFAULT_BRANDING.primary_color,
        secondary_color: branding.secondary_color || DEFAULT_BRANDING.secondary_color,
        background_color: branding.background_color || '#ffffff',
        text_color: branding.text_color || '#1e293b',
        heading_font: branding.heading_font || 'Inter',
        body_font: branding.body_font || 'Inter',
        gallery_title_template: branding.gallery_title_template || '',
        footer_text: branding.footer_text || '',
        contact_info: branding.contact_info || '',
        show_powered_by: branding.show_powered_by ?? true,
        show_job_details: branding.show_job_details ?? true,
        show_date: branding.show_date ?? true,
        show_address: branding.show_address ?? false,
      });
    }
  }, [branding]);

  const handleSave = async () => {
    // Validate colors
    if (!isValidHexColor(local.primary_color)) {
      toast({ variant: 'destructive', title: 'Invalid primary color format' });
      return;
    }
    if (!isValidHexColor(local.secondary_color)) {
      toast({ variant: 'destructive', title: 'Invalid secondary color format' });
      return;
    }
    if (!isValidHexColor(local.background_color)) {
      toast({ variant: 'destructive', title: 'Invalid background color format' });
      return;
    }
    if (!isValidHexColor(local.text_color)) {
      toast({ variant: 'destructive', title: 'Invalid text color format' });
      return;
    }

    try {
      await updateBranding({
        logo_url: local.logo_url || null,
        background_image_url: local.background_image_url || null,
        favicon_url: local.favicon_url || null,
        primary_color: local.primary_color,
        secondary_color: local.secondary_color,
        background_color: local.background_color,
        text_color: local.text_color,
        heading_font: local.heading_font,
        body_font: local.body_font,
        gallery_title_template: local.gallery_title_template || null,
        footer_text: local.footer_text || null,
        contact_info: local.contact_info || null,
        show_powered_by: local.show_powered_by,
        show_job_details: local.show_job_details,
        show_date: local.show_date,
        show_address: local.show_address,
      });
      toast({ title: 'Branding saved successfully' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to save branding', description: error.message });
    }
  };

  const handleReset = async () => {
    try {
      await resetToDefaults();
      toast({ title: 'Branding reset to defaults' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to reset branding', description: error.message });
    }
  };

  if (isLoading || settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Show disabled state when branding is not enabled
  if (!sharingSettings.gallery_branding_enabled) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Gallery Branding
          </CardTitle>
          <CardDescription>
            Customize the appearance of public photo galleries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Enable "Custom Branding" in Gallery Sharing settings above to customize gallery appearance.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Gallery Branding
        </CardTitle>
        <CardDescription>
          Customize the appearance of public photo galleries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo & Images Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Image className="h-4 w-4" />
            Logo & Images
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                placeholder="https://example.com/logo.png"
                value={local.logo_url}
                onChange={(e) => setLocal({ ...local, logo_url: e.target.value })}
              />
              {local.logo_url && (
                <div className="mt-2 p-2 border rounded-md bg-muted/30 flex items-center justify-center">
                  <img
                    src={local.logo_url}
                    alt="Logo preview"
                    className="max-h-12 max-w-40 object-contain"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input
                id="favicon_url"
                placeholder="https://example.com/favicon.ico"
                value={local.favicon_url}
                onChange={(e) => setLocal({ ...local, favicon_url: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Colors Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Palette className="h-4 w-4" />
            Colors
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={local.primary_color}
                  onChange={(e) => setLocal({ ...local, primary_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  id="primary_color"
                  value={local.primary_color}
                  onChange={(e) => setLocal({ ...local, primary_color: e.target.value })}
                  placeholder="#2563eb"
                  className={cn(!isValidHexColor(local.primary_color) && 'border-destructive')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={local.secondary_color}
                  onChange={(e) => setLocal({ ...local, secondary_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  id="secondary_color"
                  value={local.secondary_color}
                  onChange={(e) => setLocal({ ...local, secondary_color: e.target.value })}
                  placeholder="#64748b"
                  className={cn(!isValidHexColor(local.secondary_color) && 'border-destructive')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background_color">Background Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={local.background_color}
                  onChange={(e) => setLocal({ ...local, background_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  id="background_color"
                  value={local.background_color}
                  onChange={(e) => setLocal({ ...local, background_color: e.target.value })}
                  placeholder="#ffffff"
                  className={cn(!isValidHexColor(local.background_color) && 'border-destructive')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text_color">Text Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={local.text_color}
                  onChange={(e) => setLocal({ ...local, text_color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <Input
                  id="text_color"
                  value={local.text_color}
                  onChange={(e) => setLocal({ ...local, text_color: e.target.value })}
                  placeholder="#1e293b"
                  className={cn(!isValidHexColor(local.text_color) && 'border-destructive')}
                />
              </div>
            </div>
          </div>

          {/* Color Preview */}
          <div className="p-4 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <div
              className="rounded-md overflow-hidden"
              style={{ backgroundColor: local.background_color }}
            >
              <div
                className="h-10 flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: local.primary_color }}
              >
                Gallery Header
              </div>
              <div className="p-3 flex gap-2 items-center">
                <div className="w-16 h-12 rounded bg-muted" />
                <div className="w-16 h-12 rounded bg-muted" />
                <div className="flex flex-col gap-1">
                  <span
                    className="text-xs font-medium"
                    style={{ color: local.text_color }}
                  >
                    Sample Text
                  </span>
                  <button
                    className="px-3 py-1.5 text-xs text-white rounded"
                    style={{ backgroundColor: local.secondary_color }}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Typography Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Type className="h-4 w-4" />
            Typography
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Heading Font</Label>
              <Select
                value={local.heading_font}
                onValueChange={(value) => setLocal({ ...local, heading_font: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEADING_FONT_OPTIONS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select
                value={local.body_font}
                onValueChange={(value) => setLocal({ ...local, body_font: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-3 rounded-md border bg-muted/30">
            <p
              className="text-lg font-semibold mb-1"
              style={{ fontFamily: local.heading_font }}
            >
              Heading Preview
            </p>
            <p
              className="text-sm text-muted-foreground"
              style={{ fontFamily: local.body_font }}
            >
              Body text preview: The quick brown fox jumps over the lazy dog.
            </p>
          </div>
        </div>

        <Separator />

        {/* Content Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            Content
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gallery_title_template">Gallery Title Template</Label>
              <Input
                id="gallery_title_template"
                placeholder="Photo Gallery - Job #{job_number}"
                value={local.gallery_title_template}
                onChange={(e) => setLocal({ ...local, gallery_title_template: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{job_number}'} to insert the job number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="footer_text">Footer Text</Label>
              <Textarea
                id="footer_text"
                placeholder="© 2026 Your Business Name. All rights reserved."
                value={local.footer_text}
                onChange={(e) => setLocal({ ...local, footer_text: e.target.value.slice(0, 500) })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {local.footer_text.length}/500 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_info">Contact Information</Label>
              <Textarea
                id="contact_info"
                placeholder="Call us: (555) 123-4567&#10;Email: info@example.com"
                value={local.contact_info}
                onChange={(e) => setLocal({ ...local, contact_info: e.target.value.slice(0, 500) })}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                {local.contact_info.length}/500 characters
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Display Options Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Eye className="h-4 w-4" />
            Display Options
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show "Powered by ServiceGrid"</Label>
                <p className="text-xs text-muted-foreground">Display attribution in footer</p>
              </div>
              <Switch
                checked={local.show_powered_by}
                onCheckedChange={(checked) => setLocal({ ...local, show_powered_by: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Job Details</Label>
                <p className="text-xs text-muted-foreground">Display job title and description</p>
              </div>
              <Switch
                checked={local.show_job_details}
                onCheckedChange={(checked) => setLocal({ ...local, show_job_details: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Date</Label>
                <p className="text-xs text-muted-foreground">Display gallery creation date</p>
              </div>
              <Switch
                checked={local.show_date}
                onCheckedChange={(checked) => setLocal({ ...local, show_date: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Address</Label>
                <p className="text-xs text-muted-foreground">Display job location address</p>
              </div>
              <Switch
                checked={local.show_address}
                onCheckedChange={(checked) => setLocal({ ...local, show_address: checked })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isResetting || isUpdating}
          >
            {isResetting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reset to Defaults
          </Button>

          <Button onClick={handleSave} disabled={isUpdating || isResetting}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Branding
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
