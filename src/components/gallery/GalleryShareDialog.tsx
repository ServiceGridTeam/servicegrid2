/**
 * Gallery Share Dialog
 * Create or edit gallery share settings
 */

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Link2, ExternalLink, Loader2 } from 'lucide-react';
import { useCreateGalleryShare, useUpdateGalleryShare } from '@/hooks/useGalleryShares';
import { useGallerySharingSettings } from '@/hooks/useGallerySharingSettings';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type GalleryShare = Database['public']['Tables']['photo_gallery_shares']['Row'];

interface GalleryShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  existingShare?: GalleryShare | null;
  onSuccess?: (share: GalleryShare & { share_token?: string }) => void;
}

const EXPIRATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: 'never', label: 'Never expires' },
];

export function GalleryShareDialog({
  open,
  onOpenChange,
  jobId,
  existingShare,
  onSuccess,
}: GalleryShareDialogProps) {
  const { toast } = useToast();
  const createShare = useCreateGalleryShare();
  const updateShare = useUpdateGalleryShare();
  const { settings: featureFlags } = useGallerySharingSettings();
  const isEditing = !!existingShare;

  // Form state
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowComments, setAllowComments] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [includeComparisons, setIncludeComparisons] = useState(true);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);

  // UI state
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Initialize form from existing share
  useEffect(() => {
    if (existingShare) {
      setCustomTitle(existingShare.custom_title || '');
      setCustomMessage(existingShare.custom_message || '');
      setAllowDownload(existingShare.allow_download ?? true);
      setAllowComments(existingShare.allow_comments ?? false);
      setRequireEmail(existingShare.require_email ?? false);
      setIncludeComparisons(existingShare.include_comparisons ?? true);
      setIncludeAnnotations(existingShare.include_annotations ?? true);
      
      if (existingShare.is_permanent) {
        setExpiresInDays('never');
      } else if (existingShare.expires_at) {
        const daysLeft = Math.ceil(
          (new Date(existingShare.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 7) setExpiresInDays('7');
        else if (daysLeft <= 14) setExpiresInDays('14');
        else if (daysLeft <= 30) setExpiresInDays('30');
        else if (daysLeft <= 60) setExpiresInDays('60');
        else setExpiresInDays('90');
      }
    } else {
      // Reset form for new share
      setCustomTitle('');
      setCustomMessage('');
      setExpiresInDays('30');
      setAllowDownload(true);
      setAllowComments(false);
      setRequireEmail(false);
      setIncludeComparisons(true);
      setIncludeAnnotations(true);
      setGeneratedUrl(null);
    }
  }, [existingShare, open]);

  const handleSubmit = async () => {
    try {
      if (isEditing && existingShare) {
        // Update existing share
        const result = await updateShare.mutateAsync({
          id: existingShare.id,
          customTitle: customTitle || undefined,
          customMessage: customMessage || undefined,
          allowDownload,
          allowComments,
          requireEmail,
          includeComparisons,
          includeAnnotations,
        });
        onSuccess?.(result);
        onOpenChange(false);
      } else {
        // Create new share
        const result = await createShare.mutateAsync({
          jobId,
          customTitle: customTitle || undefined,
          customMessage: customMessage || undefined,
          expiresInDays: expiresInDays === 'never' ? null : parseInt(expiresInDays),
          allowDownload,
          allowComments,
          requireEmail,
          includeComparisons,
          includeAnnotations,
          isPermanent: expiresInDays === 'never',
        });
        
        // Show the generated URL
        const shareUrl = `${window.location.origin}/gallery/${result.share_token}`;
        setGeneratedUrl(shareUrl);
        onSuccess?.(result);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const copyToClipboard = async () => {
    const urlToCopy = generatedUrl || 
      (existingShare ? `${window.location.origin}/gallery/${existingShare.share_token}` : '');
    
    if (!urlToCopy) return;

    try {
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      toast({ title: 'Copied!', description: 'Share link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ 
        title: 'Copy failed', 
        description: 'Please copy the link manually',
        variant: 'destructive' 
      });
    }
  };

  const shareUrl = generatedUrl || 
    (existingShare ? `${window.location.origin}/gallery/${existingShare.share_token}` : '');

  const isLoading = createShare.isPending || updateShare.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Gallery Share' : 'Share Gallery'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update settings for this gallery share link.'
              : 'Create a shareable link for customers to view job photos.'}
          </DialogDescription>
        </DialogHeader>

        {/* Success state - show URL */}
        {generatedUrl && !isEditing && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Gallery Link Created</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.open(generatedUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Gallery
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}

        {/* Form */}
        {(!generatedUrl || isEditing) && (
          <div className="space-y-6 py-4">
            {/* Existing share URL */}
            {isEditing && existingShare && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Share Link</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Basic Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Custom Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Kitchen Renovation Progress"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Add a personal message for your customer..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  maxLength={1000}
                  rows={3}
                />
              </div>

              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="expiration">Link Expiration</Label>
                  <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                    <SelectTrigger id="expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRATION_OPTIONS
                        .filter(opt => opt.value !== 'never' || featureFlags.permanent_shares_enabled)
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {expiresInDays === 'never' && (
                    <p className="text-xs text-muted-foreground">
                      Permanent links never expire and are ideal for portfolio use.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Permissions</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Downloads</Label>
                  <p className="text-xs text-muted-foreground">
                    Let customers download individual photos
                  </p>
                </div>
                <Switch
                  checked={allowDownload}
                  onCheckedChange={setAllowDownload}
                />
              </div>

              {featureFlags.gallery_comments_enabled && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Comments</Label>
                    <p className="text-xs text-muted-foreground">
                      Let customers leave comments on photos
                    </p>
                  </div>
                  <Switch
                    checked={allowComments}
                    onCheckedChange={setAllowComments}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email</Label>
                  <p className="text-xs text-muted-foreground">
                    Collect email before showing gallery
                  </p>
                </div>
                <Switch
                  checked={requireEmail}
                  onCheckedChange={setRequireEmail}
                />
              </div>
            </div>

            <Separator />

            {/* Content Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Content</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Comparisons</Label>
                  <p className="text-xs text-muted-foreground">
                    Show before/after comparisons
                  </p>
                </div>
                <Switch
                  checked={includeComparisons}
                  onCheckedChange={setIncludeComparisons}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Annotations</Label>
                  <p className="text-xs text-muted-foreground">
                    Show annotated versions of photos
                  </p>
                </div>
                <Switch
                  checked={includeAnnotations}
                  onCheckedChange={setIncludeAnnotations}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Share Link'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
