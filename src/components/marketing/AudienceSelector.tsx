import { useState, useEffect } from "react";
import { Users, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterConfig,
  useAudiencePreview,
  useCustomerFilterOptions,
  useAudienceSegments,
  useCreateAudienceSegment,
} from "@/hooks/useAudienceSegments";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface AudienceSelectorProps {
  value: FilterConfig;
  onChange: (config: FilterConfig) => void;
  segmentId?: string | null;
  onSegmentChange?: (segmentId: string | null) => void;
}

export function AudienceSelector({
  value,
  onChange,
  segmentId,
  onSegmentChange,
}: AudienceSelectorProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [segmentName, setSegmentName] = useState("");

  const { data: filterOptions, isLoading: loadingOptions } = useCustomerFilterOptions();
  const { data: preview, isLoading: loadingPreview } = useAudiencePreview(value);
  const { data: segments } = useAudienceSegments();
  const createSegment = useCreateAudienceSegment();

  const handleTagToggle = (tag: string) => {
    const currentTags = value.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onChange({ ...value, tags: newTags });
  };

  const handleLeadStatusToggle = (status: string) => {
    const current = value.lead_status || [];
    const newStatuses = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...value, lead_status: newStatuses });
  };

  const handleStateToggle = (state: string) => {
    const current = value.states || [];
    const newStates = current.includes(state)
      ? current.filter((s) => s !== state)
      : [...current, state];
    onChange({ ...value, states: newStates });
  };

  const handleClearFilters = () => {
    onChange({
      exclude_unsubscribed: true,
      has_email: true,
    });
    onSegmentChange?.(null);
  };

  const handleSaveSegment = async () => {
    if (!segmentName.trim()) {
      toast.error("Please enter a segment name");
      return;
    }

    try {
      const segment = await createSegment.mutateAsync({
        name: segmentName,
        filter_config: value as unknown as Json,
        is_dynamic: true,
        estimated_count: preview?.count || 0,
      });
      
      onSegmentChange?.(segment.id);
      setSaveDialogOpen(false);
      setSegmentName("");
      toast.success("Segment saved successfully");
    } catch (error) {
      toast.error("Failed to save segment");
    }
  };

  const handleLoadSegment = (id: string) => {
    const segment = segments?.find((s) => s.id === id);
    if (segment) {
      onChange(segment.filter_config as FilterConfig);
      onSegmentChange?.(id);
    }
  };

  if (loadingOptions) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Saved Segments */}
      {segments && segments.length > 0 && (
        <div className="space-y-2">
          <Label>Load Saved Segment</Label>
          <Select value={segmentId || ""} onValueChange={handleLoadSegment}>
            <SelectTrigger>
              <SelectValue placeholder="Select a saved segment..." />
            </SelectTrigger>
            <SelectContent>
              {segments.map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  {segment.name} ({segment.estimated_count} customers)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tags Filter */}
      {filterOptions?.tags && filterOptions.tags.length > 0 && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {filterOptions.tags.map((tag) => (
              <Badge
                key={tag}
                variant={value.tags?.includes(tag) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Lead Status Filter */}
      <div className="space-y-2">
        <Label>Lead Status</Label>
        <div className="flex flex-wrap gap-2">
          {["lead", "qualified", "customer", "inactive"].map((status) => (
            <Badge
              key={status}
              variant={value.lead_status?.includes(status) ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => handleLeadStatusToggle(status)}
            >
              {status}
            </Badge>
          ))}
        </div>
      </div>

      {/* State Filter */}
      {filterOptions?.states && filterOptions.states.length > 0 && (
        <div className="space-y-2">
          <Label>States</Label>
          <div className="flex flex-wrap gap-2">
            {filterOptions.states.slice(0, 10).map((state) => (
              <Badge
                key={state}
                variant={value.states?.includes(state) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleStateToggle(state)}
              >
                {state}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="has-email">Has Email Address</Label>
          <Switch
            id="has-email"
            checked={value.has_email ?? true}
            onCheckedChange={(checked) => onChange({ ...value, has_email: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="exclude-unsubscribed">Exclude Unsubscribed</Label>
          <Switch
            id="exclude-unsubscribed"
            checked={value.exclude_unsubscribed ?? true}
            onCheckedChange={(checked) =>
              onChange({ ...value, exclude_unsubscribed: checked })
            }
          />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Audience Preview</span>
          </div>
          {loadingPreview ? (
            <Skeleton className="h-6 w-20" />
          ) : (
            <Badge variant="secondary">{preview?.count || 0} customers</Badge>
          )}
        </div>

        {preview?.sample && preview.sample.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sample recipients:</p>
            <div className="text-sm space-y-1">
              {preview.sample.map((c) => (
                <div key={c.id} className="text-muted-foreground">
                  {c.first_name} {c.last_name} • {c.email}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleClearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear Filters
        </Button>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-1" />
              Save as Segment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Audience Segment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="segment-name">Segment Name</Label>
                <Input
                  id="segment-name"
                  placeholder="e.g., Active Leads in California"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This segment will include {preview?.count || 0} customers based on current
                filters.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSegment} disabled={createSegment.isPending}>
                Save Segment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
