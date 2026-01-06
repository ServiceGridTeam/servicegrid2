import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeedbackForm } from './FeedbackForm';
import { useCustomerFeedback } from '@/hooks/useCustomerFeedback';

interface FeedbackPromptProps {
  className?: string;
}

export function FeedbackPrompt({ className }: FeedbackPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [selectedJob, setSelectedJob] = useState<{ id: string; title: string } | null>(null);
  const { pendingJobs, hasPendingFeedback, isLoadingPending } = useCustomerFeedback();

  if (isLoadingPending || !hasPendingFeedback || dismissed) {
    return null;
  }

  const firstPendingJob = pendingJobs[0];

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={className}
        >
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 relative">
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-primary/20 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">How was your experience?</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  We'd love to hear your feedback about "{firstPendingJob.jobTitle}"
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => setSelectedJob({ id: firstPendingJob.jobId, title: firstPendingJob.jobTitle })}
                  >
                    Rate Now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDismissed(true)}
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
          </DialogHeader>
          {selectedJob && (
            <FeedbackForm
              jobId={selectedJob.id}
              jobTitle={selectedJob.title}
              onComplete={() => setSelectedJob(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FeedbackPrompt;
