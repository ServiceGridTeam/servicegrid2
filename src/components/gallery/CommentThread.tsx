/**
 * Comment Thread Component
 * Displays a single comment with optional nested replies
 */

import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageCircle, HelpCircle, User, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Comment {
  id: string;
  author_name: string;
  comment_text: string;
  is_question: boolean;
  created_at: string;
  staff_reply?: string | null;
  staff_reply_at?: string | null;
  staff_reply_by?: string | null;
  parent_comment_id?: string | null;
  replies?: Comment[];
}

interface CommentThreadProps {
  comment: Comment;
  depth?: number;
  maxDepth?: number;
  allowReplies?: boolean;
  onReply?: (parentId: string) => void;
}

export function CommentThread({
  comment,
  depth = 0,
  maxDepth = 3,
  allowReplies = true,
  onReply,
}: CommentThreadProps) {
  const canReply = allowReplies && depth < maxDepth;

  return (
    <div className={cn('space-y-3', depth > 0 && 'ml-6 pl-4 border-l border-border')}>
      {/* Main comment */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.author_name}</span>
            {comment.is_question && (
              <Badge variant="secondary" className="text-xs gap-1">
                <HelpCircle className="h-3 w-3" />
                Question
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        <p className="text-sm text-foreground pl-9 whitespace-pre-wrap break-words">
          {comment.comment_text}
        </p>

        {/* Staff reply */}
        {comment.staff_reply && (
          <div className="ml-9 mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                <Shield className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="font-medium text-sm">Staff Reply</span>
              {comment.staff_reply_at && (
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.staff_reply_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">
              {comment.staff_reply}
            </p>
          </div>
        )}

        {/* Reply button */}
        {canReply && onReply && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-9 text-muted-foreground hover:text-foreground"
            onClick={() => onReply(comment.id)}
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              allowReplies={allowReplies}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
