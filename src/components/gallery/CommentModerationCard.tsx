/**
 * Comment Moderation Card
 * Individual comment display for staff moderation
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import {
  MoreHorizontal,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  MessageSquare,
  HelpCircle,
  Mail,
  Trash2,
  Image,
} from 'lucide-react';
import type { ModerationComment } from '@/hooks/useGalleryCommentsModeration';

interface CommentModerationCardProps {
  comment: ModerationComment;
  onMarkRead: (commentId: string, isRead: boolean) => void;
  onResolve: (commentId: string, isResolved: boolean) => void;
  onHide: (commentId: string, isHidden: boolean, reason?: string) => void;
  onAddReply: (commentId: string, reply: string) => void;
  onDeleteReply: (commentId: string) => void;
  isUpdating?: boolean;
}

export function CommentModerationCard({
  comment,
  onMarkRead,
  onResolve,
  onHide,
  onAddReply,
  onDeleteReply,
  isUpdating,
}: CommentModerationCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState(comment.staff_reply || '');
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [hideReason, setHideReason] = useState('');

  const handleSubmitReply = () => {
    if (!replyText.trim()) return;
    onAddReply(comment.id, replyText.trim());
    setShowReplyForm(false);
  };

  const handleHide = () => {
    onHide(comment.id, true, hideReason);
    setHideDialogOpen(false);
    setHideReason('');
  };

  const jobNumber = comment.job_media?.job?.job_number;
  const jobTitle = comment.job_media?.job?.title;

  return (
    <div className={`p-4 border rounded-lg ${!comment.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Photo thumbnail */}
          {comment.job_media?.thumbnail_url_sm ? (
            <img
              src={comment.job_media.thumbnail_url_sm}
              alt="Photo"
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Author info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{comment.author_name}</span>
              {!comment.is_read && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  New
                </Badge>
              )}
              {comment.is_question && !comment.is_resolved && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600">
                  <HelpCircle className="h-3 w-3 mr-0.5" />
                  Question
                </Badge>
              )}
              {comment.is_resolved && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600">
                  <CheckCircle className="h-3 w-3 mr-0.5" />
                  Resolved
                </Badge>
              )}
              {comment.is_hidden && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  <EyeOff className="h-3 w-3 mr-0.5" />
                  Hidden
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
              {comment.author_email && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {comment.author_email}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isUpdating}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            {!comment.is_read ? (
              <DropdownMenuItem onClick={() => onMarkRead(comment.id, true)}>
                <Eye className="h-4 w-4 mr-2" />
                Mark as read
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onMarkRead(comment.id, false)}>
                <EyeOff className="h-4 w-4 mr-2" />
                Mark as unread
              </DropdownMenuItem>
            )}
            
            {comment.is_question && (
              <>
                {!comment.is_resolved ? (
                  <DropdownMenuItem onClick={() => onResolve(comment.id, true)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as resolved
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onResolve(comment.id, false)}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reopen question
                  </DropdownMenuItem>
                )}
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => setShowReplyForm(true)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {comment.staff_reply ? 'Edit reply' : 'Add reply'}
            </DropdownMenuItem>

            {comment.staff_reply && (
              <DropdownMenuItem 
                onClick={() => onDeleteReply(comment.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete reply
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {!comment.is_hidden ? (
              <DropdownMenuItem 
                onClick={() => setHideDialogOpen(true)}
                className="text-destructive"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Hide comment
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onHide(comment.id, false)}>
                <Eye className="h-4 w-4 mr-2" />
                Unhide comment
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Job info */}
      {(jobNumber || jobTitle) && (
        <p className="text-xs text-muted-foreground mb-2">
          Job: {jobNumber}{jobTitle && ` - ${jobTitle}`}
        </p>
      )}

      {/* Comment text */}
      <p className="text-sm mb-3 whitespace-pre-wrap">{comment.comment_text}</p>

      {/* Hidden reason */}
      {comment.is_hidden && comment.hidden_reason && (
        <div className="text-xs text-muted-foreground mb-3 p-2 bg-destructive/10 rounded">
          Hidden reason: {comment.hidden_reason}
        </div>
      )}

      {/* Staff reply */}
      {comment.staff_reply && !showReplyForm && (
        <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {comment.admin?.first_name?.[0]}
                {comment.admin?.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium">
              {comment.admin?.first_name} {comment.admin?.last_name}
            </span>
            <span className="text-xs text-muted-foreground">
              {comment.staff_reply_at && formatDistanceToNow(new Date(comment.staff_reply_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm">{comment.staff_reply}</p>
        </div>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Write a reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[80px]"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {replyText.length}/2000
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText(comment.staff_reply || '');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || isUpdating}
              >
                {comment.staff_reply ? 'Update Reply' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hide dialog */}
      <AlertDialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the comment from the public gallery. You can unhide it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for hiding (optional)"
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHide} className="bg-destructive text-destructive-foreground">
              Hide Comment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
