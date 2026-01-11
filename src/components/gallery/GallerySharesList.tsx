/**
 * Gallery Shares List
 * Display and manage all gallery shares for a job
 */

import { useState } from 'react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Users,
  Ban,
  Pencil,
  Trash2,
  Check,
  Plus,
  ImageOff,
} from 'lucide-react';
import { useGalleryShares, useRevokeGalleryShare, type GalleryShareWithDetails } from '@/hooks/useGalleryShares';
import { useToast } from '@/hooks/use-toast';
import { GalleryShareDialog } from './GalleryShareDialog';

interface GallerySharesListProps {
  jobId: string;
}

type ShareStatus = 'active' | 'expired' | 'revoked';

function getShareStatus(share: GalleryShareWithDetails): ShareStatus {
  if (share.revoked_at) return 'revoked';
  if (share.expires_at && isPast(new Date(share.expires_at))) return 'expired';
  return 'active';
}

function StatusBadge({ status }: { status: ShareStatus }) {
  switch (status) {
    case 'active':
      return <Badge variant="default" className="bg-green-600">Active</Badge>;
    case 'expired':
      return <Badge variant="secondary">Expired</Badge>;
    case 'revoked':
      return <Badge variant="destructive">Revoked</Badge>;
  }
}

export function GallerySharesList({ jobId }: GallerySharesListProps) {
  const { data: shares, isLoading } = useGalleryShares(jobId);
  const revokeShare = useRevokeGalleryShare();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<GalleryShareWithDetails | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [shareToRevoke, setShareToRevoke] = useState<GalleryShareWithDetails | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyLink = async (share: GalleryShareWithDetails) => {
    const url = `${window.location.origin}/gallery/${share.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(share.id);
      toast({ title: 'Copied!', description: 'Share link copied to clipboard' });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ 
        title: 'Copy failed', 
        description: 'Please copy the link manually',
        variant: 'destructive' 
      });
    }
  };

  const openShareLink = (share: GalleryShareWithDetails) => {
    window.open(`${window.location.origin}/gallery/${share.share_token}`, '_blank');
  };

  const handleRevoke = async () => {
    if (!shareToRevoke) return;
    await revokeShare.mutateAsync(shareToRevoke.id);
    setRevokeDialogOpen(false);
    setShareToRevoke(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasShares = shares && shares.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Gallery Shares</h3>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Share
        </Button>
      </div>

      {!hasShares ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <ImageOff className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-3">No gallery shares yet</p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Your First Share
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-center">Views</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.map((share) => {
                const status = getShareStatus(share);
                const creatorName = share.creator
                  ? `${share.creator.first_name || ''} ${share.creator.last_name || ''}`.trim()
                  : 'Unknown';

                return (
                  <TableRow key={share.id}>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(share.created_at!), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        by {creatorName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {share.is_permanent ? (
                        <span className="text-sm text-muted-foreground">Never</span>
                      ) : share.expires_at ? (
                        <div>
                          <div className="text-sm">
                            {format(new Date(share.expires_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isPast(new Date(share.expires_at))
                              ? 'Expired'
                              : `in ${formatDistanceToNow(new Date(share.expires_at))}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3 text-sm">
                        <span className="flex items-center gap-1" title="Total views">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          {share.view_count || 0}
                        </span>
                        <span className="flex items-center gap-1" title="Unique visitors">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {share.unique_visitors || 0}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => copyLink(share)}>
                            {copied === share.id ? (
                              <Check className="h-4 w-4 mr-2" />
                            ) : (
                              <Copy className="h-4 w-4 mr-2" />
                            )}
                            Copy Link
                          </DropdownMenuItem>
                          {status === 'active' && (
                            <DropdownMenuItem onClick={() => openShareLink(share)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Gallery
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {status === 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => setEditingShare(share)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Settings
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setShareToRevoke(share);
                                  setRevokeDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Revoke Access
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <GalleryShareDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        jobId={jobId}
      />

      {/* Edit Dialog */}
      {editingShare && (
        <GalleryShareDialog
          open={!!editingShare}
          onOpenChange={(open) => !open && setEditingShare(null)}
          jobId={jobId}
          existingShare={editingShare}
        />
      )}

      {/* Revoke Confirmation */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Gallery Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately disable the share link. Anyone with the link will
              no longer be able to view the gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
