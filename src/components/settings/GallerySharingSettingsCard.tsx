/**
 * Gallery Sharing Settings Card
 * Feature flags and configuration for photo sharing functionality
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, MessageSquare, FileText, Link2, Palette } from 'lucide-react';
import { useGallerySharingSettings, type GallerySharingSettings } from '@/hooks/useGallerySharingSettings';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const EXPIRATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
];

export function GallerySharingSettingsCard() {
  const { settings, isLoading, updateSettings, isUpdating } = useGallerySharingSettings();
  const { toast } = useToast();

  const handleToggle = async (key: keyof GallerySharingSettings, value: boolean) => {
    try {
      await updateSettings({ [key]: value });
      toast({ title: 'Settings updated' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update settings',
        description: error.message,
      });
    }
  };

  const handleExpirationChange = async (value: string) => {
    try {
      await updateSettings({ default_expiration_days: parseInt(value) });
      toast({ title: 'Settings updated' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to update settings',
        description: error.message,
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const isMasterEnabled = settings.photo_sharing_enabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Gallery Sharing
        </CardTitle>
        <CardDescription>
          Configure photo gallery sharing features for customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Camera className="h-4 w-4 text-primary" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Photo Sharing</Label>
              <p className="text-xs text-muted-foreground">
                Enable gallery sharing for all jobs
              </p>
            </div>
          </div>
          <Switch
            checked={settings.photo_sharing_enabled}
            onCheckedChange={(checked) => handleToggle('photo_sharing_enabled', checked)}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        {/* Feature Toggles */}
        <div className={cn('space-y-4', !isMasterEnabled && 'opacity-50 pointer-events-none')}>
          <h4 className="text-sm font-medium text-muted-foreground">Features</h4>

          {/* Gallery Comments */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Customer Comments</Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to comment on photos
                </p>
              </div>
            </div>
            <Switch
              checked={settings.gallery_comments_enabled}
              onCheckedChange={(checked) => handleToggle('gallery_comments_enabled', checked)}
              disabled={isUpdating || !isMasterEnabled}
            />
          </div>

          {/* PDF Reports */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>PDF Reports</Label>
                <p className="text-xs text-muted-foreground">
                  Generate photo reports from job galleries
                </p>
              </div>
            </div>
            <Switch
              checked={settings.pdf_reports_enabled}
              onCheckedChange={(checked) => handleToggle('pdf_reports_enabled', checked)}
              disabled={isUpdating || !isMasterEnabled}
            />
          </div>

          {/* Permanent Shares */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Permanent Links</Label>
                <p className="text-xs text-muted-foreground">
                  Allow creating non-expiring gallery links
                </p>
              </div>
            </div>
            <Switch
              checked={settings.permanent_shares_enabled}
              onCheckedChange={(checked) => handleToggle('permanent_shares_enabled', checked)}
              disabled={isUpdating || !isMasterEnabled}
            />
          </div>

          {/* Gallery Branding */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label>Custom Branding</Label>
                <p className="text-xs text-muted-foreground">
                  Customize gallery colors and logo
                </p>
              </div>
            </div>
            <Switch
              checked={settings.gallery_branding_enabled}
              onCheckedChange={(checked) => handleToggle('gallery_branding_enabled', checked)}
              disabled={isUpdating || !isMasterEnabled}
            />
          </div>
        </div>

        <Separator />

        {/* Default Expiration */}
        <div className={cn('space-y-3', !isMasterEnabled && 'opacity-50 pointer-events-none')}>
          <h4 className="text-sm font-medium text-muted-foreground">Defaults</h4>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Default Link Expiration</Label>
              <p className="text-xs text-muted-foreground">
                Default expiration for new gallery links
              </p>
            </div>
            <Select
              value={settings.default_expiration_days.toString()}
              onValueChange={handleExpirationChange}
              disabled={isUpdating || !isMasterEnabled}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
