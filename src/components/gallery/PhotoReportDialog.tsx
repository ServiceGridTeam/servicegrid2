/**
 * Photo Report Dialog
 * Configure and generate PDF photo reports
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Loader2, Image as ImageIcon } from 'lucide-react';
import { useJobMedia } from '@/hooks/useJobMedia';
import { useBusiness } from '@/hooks/useBusiness';
import { useCreateReport, defaultReportConfig } from '@/hooks/usePhotoReports';

interface PhotoReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onSuccess?: () => void;
}

const REPORT_TYPES = [
  { value: 'standard', label: 'Standard Report' },
  { value: 'before_after', label: 'Before & After' },
  { value: 'detailed', label: 'Detailed (with annotations)' },
  { value: 'summary', label: 'Summary (compact)' },
];

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Grid Layout' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'before_after', label: 'Before/After Pairs' },
  { value: 'single', label: 'Single Photo per Page' },
];

const PAPER_SIZES = [
  { value: 'letter', label: 'Letter (8.5" x 11")' },
  { value: 'a4', label: 'A4 (210mm x 297mm)' },
];

const ORIENTATION_OPTIONS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

export function PhotoReportDialog({
  open,
  onOpenChange,
  jobId,
  onSuccess,
}: PhotoReportDialogProps) {
  const { data: business } = useBusiness();
  const { media, isLoading: isLoadingMedia } = useJobMedia({ jobId });
  const createReport = useCreateReport();

  // Form state
  const [title, setTitle] = useState('Photo Report');
  const [reportType, setReportType] = useState<string>(defaultReportConfig.layout);
  const [layout, setLayout] = useState<string>(defaultReportConfig.layout);
  const [paperSize, setPaperSize] = useState<string>(defaultReportConfig.paper_size);
  const [orientation, setOrientation] = useState<string>(defaultReportConfig.orientation);
  const [photosPerPage, setPhotosPerPage] = useState<number>(defaultReportConfig.photos_per_page);
  const [includeAnnotations, setIncludeAnnotations] = useState(defaultReportConfig.include_annotations);
  const [includeTimestamps, setIncludeTimestamps] = useState(defaultReportConfig.include_timestamps);
  const [includeGps, setIncludeGps] = useState(defaultReportConfig.include_gps);
  const [includeDescriptions, setIncludeDescriptions] = useState(defaultReportConfig.include_descriptions);
  const [includeComparisons, setIncludeComparisons] = useState(defaultReportConfig.include_comparisons);
  
  // Selected photos - default to all
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [initializedSelection, setInitializedSelection] = useState(false);

  // Initialize selection when media loads
  useMemo(() => {
    if (media && media.length > 0 && !initializedSelection) {
      setSelectedPhotoIds(new Set(media.map((m) => m.id)));
      setInitializedSelection(true);
    }
  }, [media, initializedSelection]);

  // Reset form when dialog opens
  useMemo(() => {
    if (open) {
      setTitle('Photo Report');
      setReportType('standard');
      setLayout(defaultReportConfig.layout);
      setPaperSize(defaultReportConfig.paper_size);
      setOrientation(defaultReportConfig.orientation);
      setPhotosPerPage(defaultReportConfig.photos_per_page);
      setIncludeAnnotations(defaultReportConfig.include_annotations);
      setIncludeTimestamps(defaultReportConfig.include_timestamps);
      setIncludeGps(defaultReportConfig.include_gps);
      setIncludeDescriptions(defaultReportConfig.include_descriptions);
      setIncludeComparisons(defaultReportConfig.include_comparisons);
      setInitializedSelection(false);
    }
  }, [open]);

  const togglePhoto = (id: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!media) return;
    if (selectedPhotoIds.size === media.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(media.map((m) => m.id)));
    }
  };

  // Estimated pages
  const estimatedPages = useMemo(() => {
    const count = selectedPhotoIds.size;
    if (count === 0) return 0;
    return Math.ceil(count / photosPerPage) + 1; // +1 for cover
  }, [selectedPhotoIds.size, photosPerPage]);

  const handleGenerate = async () => {
    if (!business || selectedPhotoIds.size === 0) return;

    try {
      await createReport.mutateAsync({
        jobId,
        businessId: business.id,
        mediaIds: Array.from(selectedPhotoIds),
        title,
        reportType,
        layout,
        paperSize,
        orientation,
        photosPerPage,
        includeAnnotations,
        includeTimestamps,
        includeGps,
        includeDescriptions,
        includeComparisons,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = createReport.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Photo Report
          </DialogTitle>
          <DialogDescription>
            Create a PDF report with selected photos and options.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Report Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Report Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Photo Report"
                maxLength={200}
              />
            </div>

            {/* Report Type & Layout */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Layout</Label>
                <Select value={layout} onValueChange={setLayout}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAYOUT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Paper Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Paper Size</Label>
                <Select value={paperSize} onValueChange={setPaperSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIENTATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Photos Per Page */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Photos Per Page</Label>
                <span className="text-sm text-muted-foreground">{photosPerPage}</span>
              </div>
              <Slider
                value={[photosPerPage]}
                onValueChange={([val]) => setPhotosPerPage(val)}
                min={1}
                max={12}
                step={1}
                className="w-full"
              />
            </div>

            <Separator />

            {/* Include Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Include in Report</h4>
              
              <div className="flex items-center justify-between">
                <Label>Annotations</Label>
                <Switch
                  checked={includeAnnotations}
                  onCheckedChange={setIncludeAnnotations}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Timestamps</Label>
                <Switch
                  checked={includeTimestamps}
                  onCheckedChange={setIncludeTimestamps}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>GPS Coordinates</Label>
                <Switch
                  checked={includeGps}
                  onCheckedChange={setIncludeGps}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Descriptions</Label>
                <Switch
                  checked={includeDescriptions}
                  onCheckedChange={setIncludeDescriptions}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Before/After Comparisons</Label>
                <Switch
                  checked={includeComparisons}
                  onCheckedChange={setIncludeComparisons}
                />
              </div>
            </div>

            <Separator />

            {/* Photo Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Select Photos ({selectedPhotoIds.size} of {media?.length || 0})
                </h4>
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedPhotoIds.size === (media?.length || 0) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {isLoadingMedia ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md" />
                  ))}
                </div>
              ) : !media || media.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No photos available</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {media.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
                      className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                        selectedPhotoIds.has(photo.id)
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo.thumbnail_url_sm || photo.url || photo.storage_path}
                        alt={photo.description || 'Photo'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1 left-1">
                        <Checkbox
                          checked={selectedPhotoIds.has(photo.id)}
                          className="bg-background/80"
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Est. {estimatedPages} pages
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={isLoading || selectedPhotoIds.size === 0}
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Report
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
