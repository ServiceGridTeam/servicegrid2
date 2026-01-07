import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSubmitReviewResponse, useGenerateReviewResponse } from '@/hooks/useReviews';
import { Star, User, Briefcase, Sparkles, Send, Loader2 } from 'lucide-react';
import type { Review } from '@/hooks/useReviews';

interface ReviewDetailModalProps {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClass} ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewDetailModal({ review, open, onOpenChange }: ReviewDetailModalProps) {
  const [responseText, setResponseText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const submitResponse = useSubmitReviewResponse();
  const generateResponse = useGenerateReviewResponse();

  if (!review) return null;

  const handleGenerateAI = async () => {
    const result = await generateResponse.mutateAsync({ reviewId: review.id });
    if (result) {
      setResponseText(result);
      setIsEditing(true);
    }
  };

  const handleSubmitResponse = async () => {
    await submitResponse.mutateAsync({ reviewId: review.id, responseText });
    setIsEditing(false);
    setResponseText('');
    onOpenChange(false);
  };

  const hasExistingResponse = !!review.response_text;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review from {review.customer?.first_name} {review.customer?.last_name}
          </DialogTitle>
          <DialogDescription>
            Submitted on {format(new Date(review.created_at), 'MMMM d, yyyy \'at\' h:mm a')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Rating Display */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Overall Rating</p>
              <StarRating rating={review.rating} size="lg" />
            </div>
            <div className="text-4xl font-bold">{review.rating}/5</div>
          </div>

          {/* Breakdown Ratings */}
          {(review.quality_rating || review.timeliness_rating || review.technician_rating) && (
            <div className="grid grid-cols-3 gap-4">
              {review.quality_rating && (
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Quality</p>
                  <StarRating rating={review.quality_rating} size="sm" />
                </div>
              )}
              {review.timeliness_rating && (
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Timeliness</p>
                  <StarRating rating={review.timeliness_rating} size="sm" />
                </div>
              )}
              {review.technician_rating && (
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Technician</p>
                  <StarRating rating={review.technician_rating} size="sm" />
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Customer Feedback */}
          <div className="space-y-2">
            <h4 className="font-medium">Customer Feedback</h4>
            {review.feedback_text ? (
              <p className="text-muted-foreground">{review.feedback_text}</p>
            ) : (
              <p className="text-muted-foreground italic">No written feedback provided</p>
            )}
          </div>

          {/* Context Info */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {review.technician && (
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {review.technician.first_name} {review.technician.last_name}
              </div>
            )}
            {review.job && (
              <div className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                {review.job.title}
              </div>
            )}
            {review.is_public && (
              <Badge variant="secondary">Public</Badge>
            )}
          </div>

          <Separator />

          {/* Response Section */}
          <div className="space-y-4">
            <h4 className="font-medium">Your Response</h4>
            
            {hasExistingResponse && !isEditing ? (
              <div className="space-y-2">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm">{review.response_text}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Responded on {review.responded_at && format(new Date(review.responded_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  setResponseText(review.response_text || '');
                  setIsEditing(true);
                }}>
                  Edit Response
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Write your response to this review..."
                  className="min-h-[120px]"
                />
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={handleGenerateAI}
                    disabled={generateResponse.isPending}
                  >
                    {generateResponse.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate with AI
                  </Button>
                  <div className="flex gap-2">
                    {isEditing && hasExistingResponse && (
                      <Button variant="ghost" onClick={() => {
                        setIsEditing(false);
                        setResponseText('');
                      }}>
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={handleSubmitResponse}
                      disabled={!responseText.trim() || submitResponse.isPending}
                    >
                      {submitResponse.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      {hasExistingResponse ? 'Update Response' : 'Submit Response'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
