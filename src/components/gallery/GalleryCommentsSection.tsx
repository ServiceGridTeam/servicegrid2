/**
 * Gallery Comments Section
 * Displays and manages comments for a gallery photo
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { CommentThread, type Comment } from './CommentThread';
import { CommentForm } from './CommentForm';
import { useGalleryComments } from '@/hooks/usePublicGallery';
import { cn } from '@/lib/utils';

interface GalleryCommentsSectionProps {
  token: string;
  mediaId: string;
  allowComments: boolean;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

export function GalleryCommentsSection({
  token,
  mediaId,
  allowComments,
  isCollapsible = true,
  defaultExpanded = false,
}: GalleryCommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [savedName, setSavedName] = useState<string>(() => {
    // Try to get saved name from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gallery_comment_name') || '';
    }
    return '';
  });

  const { postComment, fetchComments, isSubmitting, error, clearError } = useGalleryComments(token);

  // Fetch comments on mount and when mediaId changes
  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedComments = await fetchComments(mediaId);
      // Build threaded structure
      const threadedComments = buildCommentTree(fetchedComments);
      setComments(threadedComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchComments, mediaId]);

  useEffect(() => {
    if (mediaId) {
      loadComments();
    }
  }, [mediaId, loadComments]);

  // Handle comment submission
  const handleSubmit = async (data: {
    authorName: string;
    commentText: string;
    isQuestion: boolean;
    parentCommentId?: string;
  }) => {
    const result = await postComment({
      mediaId,
      commentText: data.commentText,
      authorName: data.authorName,
      isQuestion: data.isQuestion,
      parentCommentId: data.parentCommentId,
    });

    if (result) {
      // Refresh comments to get the new one
      await loadComments();
      return true;
    }
    return false;
  };

  // Handle reply click
  const handleReply = (parentId: string) => {
    const comment = findComment(comments, parentId);
    if (comment) {
      setReplyingTo({ id: parentId, name: comment.author_name });
      setIsExpanded(true);
    }
  };

  // Handle name saved
  const handleNameSaved = (name: string) => {
    setSavedName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gallery_comment_name', name);
    }
  };

  const commentCount = countComments(comments);

  // Header with toggle
  const header = (
    <div
      className={cn(
        'flex items-center justify-between py-3 px-4',
        isCollapsible && 'cursor-pointer hover:bg-muted/50 transition-colors',
      )}
      onClick={isCollapsible ? () => setIsExpanded(!isExpanded) : undefined}
    >
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <span className="font-medium text-sm">
          Comments {commentCount > 0 && `(${commentCount})`}
        </span>
      </div>
      {isCollapsible && (
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );

  // Not allowed message
  if (!allowComments) {
    return (
      <div className="border-t bg-muted/30">
        {header}
        {isExpanded && (
          <div className="px-4 pb-4 text-sm text-muted-foreground">
            Comments are disabled for this gallery.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {header}
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <Separator />
          
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs"
                onClick={clearError}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Comments list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to share your thoughts!
            </p>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-4 pr-4">
                {comments.map((comment) => (
                  <CommentThread
                    key={comment.id}
                    comment={comment}
                    allowReplies={allowComments}
                    onReply={handleReply}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          <Separator />

          {/* Comment form */}
          <CommentForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            parentCommentId={replyingTo?.id}
            replyingToName={replyingTo?.name}
            onCancelReply={() => setReplyingTo(null)}
            savedName={savedName}
            onNameSaved={handleNameSaved}
          />
        </div>
      )}
    </div>
  );
}

// Helper: Build threaded comment tree from flat list
function buildCommentTree(flatComments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const roots: Comment[] = [];

  // First pass: create all comment objects
  flatComments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build tree structure
  flatComments.forEach((comment) => {
    const node = commentMap.get(comment.id)!;
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort by date (newest first for root, oldest first for replies)
  roots.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const sortReplies = (comments: Comment[]) => {
    comments.forEach((c) => {
      if (c.replies && c.replies.length > 0) {
        c.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        sortReplies(c.replies);
      }
    });
  };
  sortReplies(roots);

  return roots;
}

// Helper: Find a comment by ID in the tree
function findComment(comments: Comment[], id: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    if (comment.replies) {
      const found = findComment(comment.replies, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper: Count total comments including replies
function countComments(comments: Comment[]): number {
  return comments.reduce((count, comment) => {
    return count + 1 + (comment.replies ? countComments(comment.replies) : 0);
  }, 0);
}
