/**
 * Gallery Share Card
 * Compact card showing active share status in job details
 */

import { useState } from 'react';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Copy,
  Check,
  ExternalLink,
  Eye,
  Users,
  Link2,
  Share2,
  Settings,
} from 'lucide-react';
import { useActiveGalleryShare } from '@/hooks/useGalleryShares';
import { useToast } from '@/hooks/use-toast';
import { GalleryShareDialog } from './GalleryShareDialog';
import { GallerySharesList } from './GallerySharesList';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GalleryShareCardProps {
  jobId: string;
}

export function GalleryShareCard({ jobId }: GalleryShareCardProps) {
  const { data: activeShare, isLoading } = useActiveGalleryShare(jobId);
  const { toast } = useToast();

  const [copied, setCopied] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  const copyLink = async () => {
    if (!activeShare) return;
    const url = `${window.location.origin}/gallery/${activeShare.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
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

  const openShareLink = () => {
    if (!activeShare) return;
    window.open(`${window.location.origin}/gallery/${activeShare.share_token}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // No active share
  if (!activeShare) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Share2 className="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Not Shared</p>
                  <p className="text-xs">Share photos with your customer</p>
                </div>
              </div>
              <Button size="sm" onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4 mr-1" />
                Share Gallery
              </Button>
            </div>
          </CardContent>
        </Card>

        <GalleryShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          jobId={jobId}
        />
      </>
    );
  }

  // Active share exists
  const expiresText = activeShare.is_permanent
    ? 'Never expires'
    : activeShare.expires_at
    ? isPast(new Date(activeShare.expires_at))
      ? 'Expired'
      : `Expires ${formatDistanceToNow(new Date(activeShare.expires_at), { addSuffix: true })}`
    : '';

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-lg bg-primary/10">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">Gallery Shared</span>
                  <Badge variant="default" className="bg-green-600 text-[10px] px-1.5">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {expiresText}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {activeShare.view_count || 0} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {activeShare.unique_visitors || 0} visitors
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={copyLink}
                title="Copy link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={openShareLink}
                title="Open gallery"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setManageDialogOpen(true)}
                title="Manage shares"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Shares Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Gallery Shares</DialogTitle>
          </DialogHeader>
          <GallerySharesList jobId={jobId} />
        </DialogContent>
      </Dialog>
    </>
  );
}
