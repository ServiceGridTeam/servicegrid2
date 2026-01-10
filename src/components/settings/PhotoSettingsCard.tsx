import { useState, useEffect } from "react";
import { Camera, MapPin, Clock, Image, Film, Loader2, Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePhotoSettings, PhotoSettings, DEFAULT_PHOTO_SETTINGS } from "@/hooks/usePhotoSettings";
import type { MediaCategory } from "@/hooks/useJobMedia";

const ALL_CATEGORIES: { value: MediaCategory; label: string }[] = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "damage", label: "Damage" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "general", label: "General" },
];

const WATERMARK_POSITIONS = [
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
] as const;

export function PhotoSettingsCard() {
  const { photoSettings, isLoading, updatePhotoSettings, isUpdating } = usePhotoSettings();
  const [localSettings, setLocalSettings] = useState<PhotoSettings>(DEFAULT_PHOTO_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local state from loaded settings
  useEffect(() => {
    if (photoSettings) {
      setLocalSettings(photoSettings);
      setHasChanges(false);
    }
  }, [photoSettings]);

  const handleChange = <K extends keyof PhotoSettings>(key: K, value: PhotoSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleCategory = (category: MediaCategory) => {
    const current = localSettings.allowed_categories;
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    
    // Ensure at least one category is selected
    if (updated.length === 0) return;
    
    handleChange("allowed_categories", updated);
  };

  const handleSave = async () => {
    await updatePhotoSettings(localSettings);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Photo & Media Settings
          </CardTitle>
        </CardHeader>
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
          <Camera className="h-5 w-5" />
          Photo & Media Settings
        </CardTitle>
        <CardDescription>
          Configure photo and video capture requirements for field staff
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GPS & Location */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Location Requirements
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="require-gps">Require GPS on photos</Label>
              <p className="text-sm text-muted-foreground">
                Block capture if device location is unavailable
              </p>
            </div>
            <Switch
              id="require-gps"
              checked={localSettings.require_gps}
              onCheckedChange={(checked) => handleChange("require_gps", checked)}
            />
          </div>
        </div>

        {/* Watermark */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Image className="h-4 w-4" />
            Watermarking
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-watermark">Auto-watermark photos</Label>
              <p className="text-sm text-muted-foreground">
                Add business logo overlay to all photos
              </p>
            </div>
            <Switch
              id="auto-watermark"
              checked={localSettings.auto_watermark}
              onCheckedChange={(checked) => handleChange("auto_watermark", checked)}
            />
          </div>
          {localSettings.auto_watermark && (
            <div className="space-y-2">
              <Label htmlFor="watermark-position">Watermark Position</Label>
              <Select
                value={localSettings.watermark_position}
                onValueChange={(value) => 
                  handleChange("watermark_position", value as PhotoSettings["watermark_position"])
                }
              >
                <SelectTrigger id="watermark-position" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WATERMARK_POSITIONS.map((pos) => (
                    <SelectItem key={pos.value} value={pos.value}>
                      {pos.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Limits */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Size & Duration Limits
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-photo-size">Max photo size (MB)</Label>
              <Input
                id="max-photo-size"
                type="number"
                min={1}
                max={50}
                value={localSettings.max_photo_size_mb}
                onChange={(e) => handleChange("max_photo_size_mb", Number(e.target.value) || 10)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-video-duration">Max video duration (seconds)</Label>
              <Input
                id="max-video-duration"
                type="number"
                min={10}
                max={300}
                value={localSettings.max_video_duration_seconds}
                onChange={(e) => handleChange("max_video_duration_seconds", Number(e.target.value) || 60)}
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Tag className="h-4 w-4" />
            Allowed Categories
          </div>
          <p className="text-sm text-muted-foreground">
            Select which photo categories field staff can choose from
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = localSettings.allowed_categories.includes(cat.value);
              return (
                <Badge
                  key={cat.value}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer select-none transition-colors"
                  onClick={() => toggleCategory(cat.value)}
                >
                  {cat.label}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Video Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Film className="h-4 w-4" />
            Quality Settings
          </div>
          <div className="space-y-2">
            <Label htmlFor="thumbnail-quality">Thumbnail quality ({localSettings.default_thumbnail_quality}%)</Label>
            <Input
              id="thumbnail-quality"
              type="range"
              min={50}
              max={100}
              step={5}
              value={localSettings.default_thumbnail_quality}
              onChange={(e) => handleChange("default_thumbnail_quality", Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <Button onClick={handleSave} disabled={!hasChanges || isUpdating}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
