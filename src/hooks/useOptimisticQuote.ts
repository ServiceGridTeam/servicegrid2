import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { approveQuote, declineQuote, requestQuoteChanges } from '@/lib/portalApi';

interface UseOptimisticQuoteOptions {
  quoteId: string;
  currentStatus: string;
  onSuccess?: (newStatus: string) => void;
}

interface OptimisticState {
  status: string;
  isPending: boolean;
  error: string | null;
}

export function useOptimisticQuote({ quoteId, currentStatus, onSuccess }: UseOptimisticQuoteOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<OptimisticState>({
    status: currentStatus,
    isPending: false,
    error: null,
  });

  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#34d399', '#6ee7b7'],
    });
  }, []);

  const approve = useCallback(async () => {
    // Optimistic update - instant feedback
    const previousStatus = state.status;
    setState({ status: 'Approved', isPending: true, error: null });
    triggerConfetti();

    try {
      const { data, error } = await approveQuote(quoteId);

      if (error) {
        // Rollback on error
        setState({ status: previousStatus, isPending: false, error: error.message });
        toast.error('Failed to approve quote', { description: error.message });
        return false;
      }

      // Confirm success
      setState({ status: data?.newStatus || 'Approved', isPending: false, error: null });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['portal-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
      
      toast.success('Quote approved!', { description: 'The business has been notified.' });
      onSuccess?.(data?.newStatus || 'Approved');
      return true;
    } catch (err) {
      // Rollback on error
      setState({ status: previousStatus, isPending: false, error: 'Network error' });
      toast.error('Failed to approve quote');
      return false;
    }
  }, [quoteId, state.status, queryClient, onSuccess, triggerConfetti]);

  const decline = useCallback(async (reason?: string) => {
    const previousStatus = state.status;
    setState({ status: 'Declined', isPending: true, error: null });

    try {
      const { data, error } = await declineQuote(quoteId, reason);

      if (error) {
        setState({ status: previousStatus, isPending: false, error: error.message });
        toast.error('Failed to decline quote', { description: error.message });
        return false;
      }

      setState({ status: data?.newStatus || 'Declined', isPending: false, error: null });
      
      queryClient.invalidateQueries({ queryKey: ['portal-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
      
      toast.success('Quote declined');
      onSuccess?.(data?.newStatus || 'Declined');
      return true;
    } catch (err) {
      setState({ status: previousStatus, isPending: false, error: 'Network error' });
      toast.error('Failed to decline quote');
      return false;
    }
  }, [quoteId, state.status, queryClient, onSuccess]);

  const requestChanges = useCallback(async (notes: string) => {
    if (!notes.trim()) {
      toast.error('Please provide details about the changes you need');
      return false;
    }

    const previousStatus = state.status;
    setState({ status: 'Edits Requested', isPending: true, error: null });

    try {
      const { data, error } = await requestQuoteChanges(quoteId, notes);

      if (error) {
        setState({ status: previousStatus, isPending: false, error: error.message });
        toast.error('Failed to request changes', { description: error.message });
        return false;
      }

      setState({ status: data?.newStatus || 'Edits Requested', isPending: false, error: null });
      
      queryClient.invalidateQueries({ queryKey: ['portal-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
      
      toast.success('Change request sent', { description: 'The business will review your request.' });
      onSuccess?.(data?.newStatus || 'Edits Requested');
      return true;
    } catch (err) {
      setState({ status: previousStatus, isPending: false, error: 'Network error' });
      toast.error('Failed to request changes');
      return false;
    }
  }, [quoteId, state.status, queryClient, onSuccess]);

  return {
    status: state.status,
    isPending: state.isPending,
    error: state.error,
    approve,
    decline,
    requestChanges,
  };
}
