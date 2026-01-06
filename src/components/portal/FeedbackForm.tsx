import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCustomerFeedback } from '@/hooks/useCustomerFeedback';

interface FeedbackFormProps {
  jobId: string;
  jobTitle: string;
  onComplete?: () => void;
}

export function FeedbackForm({ jobId, jobTitle, onComplete }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [technicianRating, setTechnicianRating] = useState(0);
  const [timelinessRating, setTimelinessRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const { submit, isSubmitting } = useCustomerFeedback();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    submit({
      jobId,
      rating,
      comment: comment.trim() || undefined,
      technicianRating: technicianRating || undefined,
      timelinessRating: timelinessRating || undefined,
      qualityRating: qualityRating || undefined,
    }, {
      onSuccess: () => {
        setIsComplete(true);
        onComplete?.();
      },
    });
  };

  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        >
          <Heart className="h-16 w-16 text-primary mx-auto mb-4 fill-primary" />
        </motion.div>
        <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
        <p className="text-muted-foreground">
          Your feedback helps us improve our service.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h3 className="font-semibold mb-1">Rate Your Experience</h3>
        <p className="text-sm text-muted-foreground">{jobTitle}</p>
      </div>

      {/* Main Rating */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1"
          >
            <Star
              className={cn(
                'h-10 w-10 transition-colors',
                (hoverRating || rating) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </motion.button>
        ))}
      </div>

      {/* Sub-ratings (appear after main rating is selected) */}
      <AnimatePresence>
        {rating > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            <SubRating
              label="Technician"
              value={technicianRating}
              onChange={setTechnicianRating}
            />
            <SubRating
              label="Timeliness"
              value={timelinessRating}
              onChange={setTimelinessRating}
            />
            <SubRating
              label="Quality"
              value={qualityRating}
              onChange={setQualityRating}
            />

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Additional Comments (optional)</Label>
              <Textarea
                id="comment"
                placeholder="Tell us more about your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

interface SubRatingProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function SubRating({ label, value, onChange }: SubRatingProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            type="button"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                (hover || value) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/50'
              )}
            />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default FeedbackForm;
