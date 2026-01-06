import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Edit, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOptimisticQuote } from '@/hooks/useOptimisticQuote';
import { RequestChangesDialog } from './RequestChangesDialog';

interface QuoteActionsProps {
  quoteId: string;
  currentStatus: string;
  onActionComplete?: () => void;
}

export function QuoteActions({ quoteId, currentStatus, onActionComplete }: QuoteActionsProps) {
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  const { status, isPending, approve, decline, requestChanges } = useOptimisticQuote({
    quoteId,
    currentStatus,
    onSuccess: onActionComplete,
  });

  const canTakeAction = status === 'Sent';

  const handleApprove = async () => {
    await approve();
  };

  const handleDecline = async () => {
    if (!showDeclineConfirm) {
      setShowDeclineConfirm(true);
      return;
    }
    await decline();
    setShowDeclineConfirm(false);
  };

  const handleRequestChanges = async (notes: string) => {
    const success = await requestChanges(notes);
    if (success) {
      setShowRequestChanges(false);
    }
    return success;
  };

  if (!canTakeAction) {
    return (
      <div className="flex items-center justify-center py-4">
        <StatusBadge status={status} />
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
      >
        <AnimatePresence mode="wait">
          {showDeclineConfirm ? (
            <motion.div
              key="decline-confirm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-2"
            >
              <span className="text-sm text-muted-foreground">Decline this quote?</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDecline}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Decline'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeclineConfirm(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleApprove}
                  disabled={isPending}
                  className="gap-2"
                  size="lg"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approve Quote
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  variant="outline"
                  onClick={() => setShowRequestChanges(true)}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Request Changes
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  variant="ghost"
                  onClick={handleDecline}
                  disabled={isPending}
                  className="gap-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                  Decline
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <RequestChangesDialog
        open={showRequestChanges}
        onOpenChange={setShowRequestChanges}
        onSubmit={handleRequestChanges}
        isPending={isPending}
      />
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    Approved: { variant: 'default', label: 'Approved' },
    Declined: { variant: 'destructive', label: 'Declined' },
    'Edits Requested': { variant: 'secondary', label: 'Changes Requested' },
    Draft: { variant: 'outline', label: 'Draft' },
    Sent: { variant: 'secondary', label: 'Pending Review' },
  };

  const config = variants[status] || { variant: 'outline' as const, label: status };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <Badge variant={config.variant} className="text-sm px-4 py-1.5">
        {status === 'Approved' && <Check className="h-3 w-3 mr-1.5" />}
        {status === 'Declined' && <X className="h-3 w-3 mr-1.5" />}
        {config.label}
      </Badge>
    </motion.div>
  );
}
