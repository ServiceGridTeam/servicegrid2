/**
 * Share Comparison Dialog - Generate and manage share links
 */

import { useState } from 'react';
import { Copy, Check, Link, Calendar, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShareComparison, useRevokeShareLink } from '@/hooks/useComparisons';
import { ComparisonWithMedia } from '@/types/annotations';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

interface ShareComparisonDialogProps {
  comparison: ComparisonWithMedia;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExpirationDays = '7' | '30' | '90' | '365' | 'never';

export function ShareComparisonDialog({
  comparison,
  open,
  onOpenChange,
}: ShareComparisonDialogProps) {
  const shareComparison = useShareComparison();
  const revokeShareLink = useRevokeShareLink();
  const [copied, setCopied] = useState(false);
  const [expirationDays, setExpirationDays] = useState<ExpirationDays>('30');

  const isShared = comparison.is_public && comparison.share_token;
  const shareUrl = isShared 
    ? `${window.location.origin}/compare/${comparison.share_token}`
    : null;

  const handleGenerateLink = async () => {
    try {
      const days = expirationDays === 'never' ? null : parseInt(expirationDays);
      await shareComparison.mutateAsync({
        comparisonId: comparison.id,
        expiresInDays: days,
      });
      toast.success('Share link generated');
    } catch (error) {
      console.error('Failed to generate share link:', error);
      toast.error('Failed to generate share link');
    }
  };

  const handleRemoveLink = async () => {
    try {
      await revokeShareLink.mutateAsync(comparison.id);
      toast.success('Share link removed');
    } catch (error) {
      console.error('Failed to remove share link:', error);
      toast.error('Failed to remove share link');
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const getExpiryDate = () => {
    if (expirationDays === 'never') return 'Never';
    return format(addDays(new Date(), parseInt(expirationDays)), 'MMM d, yyyy');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Share Comparison
          </DialogTitle>
          <DialogDescription>
            {isShared 
              ? 'Anyone with the link can view this comparison.'
              : 'Generate a public link to share this comparison.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isShared ? (
            <>
              {/* Share URL */}
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={shareUrl || ''}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Expiry info */}
              {comparison.share_expires_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Expires {format(new Date(comparison.share_expires_at), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(shareUrl!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Link
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRemoveLink}
                  disabled={revokeShareLink.isPending}
                >
                  Remove Link
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Expiration selector */}
              <div className="space-y-2">
                <Label>Link Expiration</Label>
                <Select 
                  value={expirationDays} 
                  onValueChange={(v) => setExpirationDays(v as ExpirationDays)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="never">Never expires</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link will expire on {getExpiryDate()}
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {!isShared && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateLink}
                disabled={shareComparison.isPending}
              >
                {shareComparison.isPending ? 'Generating...' : 'Generate Link'}
              </Button>
            </>
          )}
          {isShared && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
