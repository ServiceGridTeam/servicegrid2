/**
 * Comment Form Component
 * Form for submitting comments on gallery photos
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Send, X } from 'lucide-react';

interface CommentFormProps {
  onSubmit: (data: {
    authorName: string;
    commentText: string;
    isQuestion: boolean;
    parentCommentId?: string;
  }) => Promise<boolean>;
  isSubmitting?: boolean;
  parentCommentId?: string;
  replyingToName?: string;
  onCancelReply?: () => void;
  savedName?: string;
  onNameSaved?: (name: string) => void;
}

export function CommentForm({
  onSubmit,
  isSubmitting = false,
  parentCommentId,
  replyingToName,
  onCancelReply,
  savedName,
  onNameSaved,
}: CommentFormProps) {
  const [authorName, setAuthorName] = useState(savedName || '');
  const [commentText, setCommentText] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authorName.trim() || !commentText.trim()) return;

    const success = await onSubmit({
      authorName: authorName.trim(),
      commentText: commentText.trim(),
      isQuestion,
      parentCommentId,
    });

    if (success) {
      // Save name for future comments
      onNameSaved?.(authorName.trim());
      // Clear form
      setCommentText('');
      setIsQuestion(false);
      onCancelReply?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Reply indicator */}
      {replyingToName && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <span>Replying to <strong>{replyingToName}</strong></span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 ml-auto"
            onClick={onCancelReply}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Name input - only show if not saved */}
      {!savedName && (
        <div className="space-y-2">
          <Label htmlFor="author-name">Your Name</Label>
          <Input
            id="author-name"
            placeholder="Enter your name"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={100}
            required
          />
        </div>
      )}

      {/* Comment text */}
      <div className="space-y-2">
        <Label htmlFor="comment-text">
          {parentCommentId ? 'Your Reply' : 'Your Comment'}
        </Label>
        <Textarea
          id="comment-text"
          placeholder={parentCommentId ? 'Write your reply...' : 'Share your thoughts or ask a question...'}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          maxLength={2000}
          rows={3}
          required
        />
        <p className="text-xs text-muted-foreground text-right">
          {commentText.length}/2000
        </p>
      </div>

      {/* Question checkbox - only for top-level comments */}
      {!parentCommentId && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is-question"
            checked={isQuestion}
            onCheckedChange={(checked) => setIsQuestion(checked === true)}
          />
          <Label htmlFor="is-question" className="text-sm cursor-pointer">
            This is a question (staff will be notified)
          </Label>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        disabled={isSubmitting || !authorName.trim() || !commentText.trim()}
        className="w-full sm:w-auto"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Posting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            {parentCommentId ? 'Post Reply' : 'Post Comment'}
          </>
        )}
      </Button>
    </form>
  );
}
