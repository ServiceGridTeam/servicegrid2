/**
 * MessageBubble component
 * Displays individual message with sender info, actions, and animations
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  Pencil, 
  Trash2, 
  Reply, 
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  formatMessageTime, 
  getRemainingEditTime,
  canEditMessage,
  canDeleteMessage,
  triggerHaptic,
  type Attachment,
} from '@/lib/messageUtils';
import { AttachmentPreview } from './AttachmentPreview';
import type { MessageWithDetails } from '@/hooks/useMessages';

interface MessageBubbleProps {
  message: MessageWithDetails;
  isOwn: boolean;
  userId: string | null;
  userRole?: string | null;
  onEdit?: (messageId: string, content: string, version: number) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (message: MessageWithDetails) => void;
  onRetry?: (content: string) => void;
  showSender?: boolean;
}

export function MessageBubble({
  message,
  isOwn,
  userId,
  userRole,
  onEdit,
  onDelete,
  onReply,
  onRetry,
  showSender = true,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canEdit = canEditMessage(message, userId);
  const canDelete = canDeleteMessage(message, userId, userRole);
  const remainingEditTime = getRemainingEditTime(message.created_at);

  const handleStartEdit = useCallback(() => {
    triggerHaptic(5);
    setEditContent(message.content);
    setIsEditing(true);
  }, [message.content]);

  const handleSaveEdit = useCallback(() => {
    if (editContent.trim() && editContent !== message.content && onEdit) {
      onEdit(message.id, editContent.trim(), message.version);
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, message.version, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(message.id);
    }
    setShowDeleteDialog(false);
  }, [message.id, onDelete]);

  const handleReply = useCallback(() => {
    triggerHaptic(5);
    onReply?.(message);
  }, [message, onReply]);

  const handleRetry = useCallback(() => {
    onRetry?.(message.content);
  }, [message.content, onRetry]);

  const senderName = message.sender_name || 'Unknown';
  const senderInitials = senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isSending = message.isSending;
  const hasError = message.sendError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'group flex gap-3',
        isOwn ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      {showSender && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={message.sender_profile?.avatar_url || undefined} />
          <AvatarFallback className="text-xs bg-muted">
            {senderInitials}
          </AvatarFallback>
        </Avatar>
      )}
      {!showSender && <div className="w-8" />}

      <div className={cn('flex flex-col max-w-[70%]', isOwn && 'items-end')}>
        {/* Sender name and time */}
        {showSender && (
          <div className={cn(
            'flex items-center gap-2 mb-1 text-xs text-muted-foreground',
            isOwn && 'flex-row-reverse'
          )}>
            <span className="font-medium">{senderName}</span>
            <span>{formatMessageTime(message.created_at)}</span>
            {message.is_edited && (
              <span className="text-muted-foreground/70">(edited)</span>
            )}
          </div>
        )}

        {/* Reply context */}
        {message.reply_to && (
          <div className={cn(
            'mb-1 px-3 py-1.5 rounded-md text-xs bg-muted/50 border-l-2 border-muted-foreground/30',
            isOwn && 'text-right'
          )}>
            <span className="font-medium">{message.reply_to.sender_name}</span>
            <p className="text-muted-foreground truncate max-w-[200px]">
              {message.reply_to.content}
            </p>
          </div>
        )}

        {/* Message bubble */}
        <div className="relative">
          <div
            className={cn(
              'relative px-4 py-2 rounded-2xl',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md',
              isSending && 'opacity-70',
              hasError && 'border border-destructive'
            )}
          >
            {isEditing ? (
              <div className="space-y-2 min-w-[200px]">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] bg-background text-foreground"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {message.content_html ? (
                  <div
                    className="text-sm whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: message.content_html }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}
                
                {/* Attachments */}
                {message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0 && (
                  <AttachmentPreview 
                    attachments={message.attachments as unknown as Attachment[]} 
                    isOwn={isOwn}
                  />
                )}
              </>
            )}

            {/* Sending indicator */}
            {isSending && (
              <div className="absolute -right-1 -bottom-1">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Error state */}
          <AnimatePresence>
            {hasError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-2 mt-1 text-xs text-destructive"
              >
                <AlertCircle className="h-3 w-3" />
                <span>Failed to send</span>
                {onRetry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-xs"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions dropdown */}
          {!isEditing && !isSending && !hasError && (
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity',
                isOwn ? '-left-8' : '-right-8'
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
                  {onReply && (
                    <DropdownMenuItem onClick={handleReply}>
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </DropdownMenuItem>
                  )}
                  {canEdit && onEdit && (
                    <DropdownMenuItem onClick={handleStartEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                      {remainingEditTime && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {remainingEditTime}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  {canDelete && onDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Time for non-sender messages */}
        {!showSender && (
          <span className={cn(
            'text-[10px] text-muted-foreground mt-0.5',
            isOwn && 'text-right'
          )}>
            {formatMessageTime(message.created_at)}
          </span>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be removed from the conversation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
