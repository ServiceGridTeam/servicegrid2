import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { createPaymentIntent } from '@/lib/portalApi';

type PaymentState = 'ready' | 'processing' | 'success' | 'error';

interface UseOptimisticPaymentOptions {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  onSuccess?: () => void;
}

interface PaymentResult {
  state: PaymentState;
  error: string | null;
  paymentIntentId: string | null;
}

export function useOptimisticPayment({
  invoiceId,
  invoiceNumber,
  amount,
  onSuccess,
}: UseOptimisticPaymentOptions) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<PaymentResult>({
    state: 'ready',
    error: null,
    paymentIntentId: null,
  });
  const optimisticTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerConfetti = useCallback(() => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b'],
    });
  }, []);

  const pay = useCallback(async (paymentMethodId?: string) => {
    setResult({ state: 'processing', error: null, paymentIntentId: null });

    // Start optimistic success timer (1.5s)
    optimisticTimerRef.current = setTimeout(() => {
      setResult(prev => {
        if (prev.state === 'processing') {
          triggerConfetti();
          return { state: 'success', error: null, paymentIntentId: prev.paymentIntentId };
        }
        return prev;
      });
    }, 1500);

    try {
      const { data, error } = await createPaymentIntent(invoiceId, paymentMethodId);

      if (error) {
        // Clear optimistic timer on error
        if (optimisticTimerRef.current) {
          clearTimeout(optimisticTimerRef.current);
        }
        setResult({ state: 'error', error: error.message, paymentIntentId: null });
        toast.error('Payment failed', { description: error.message });
        return { success: false, error: error.message };
      }

      // If payment succeeded immediately (using saved card)
      if (data?.status === 'succeeded') {
        if (optimisticTimerRef.current) {
          clearTimeout(optimisticTimerRef.current);
        }
        setResult({ state: 'success', error: null, paymentIntentId: data.paymentIntentId });
        triggerConfetti();
        
        // Invalidate caches
        queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
        
        toast.success('Payment successful!', {
          description: `Invoice ${invoiceNumber} has been paid.`,
        });
        onSuccess?.();
        return { success: true, clientSecret: data.clientSecret };
      }

      // For payments requiring further action (like 3DS)
      if (data?.status === 'requires_action' || data?.status === 'requires_payment_method') {
        if (optimisticTimerRef.current) {
          clearTimeout(optimisticTimerRef.current);
        }
        setResult({ state: 'processing', error: null, paymentIntentId: data.paymentIntentId });
        return { success: true, clientSecret: data.clientSecret, requiresAction: true };
      }

      // Payment is processing - let the optimistic timer handle UI
      setResult(prev => ({ ...prev, paymentIntentId: data?.paymentIntentId || null }));
      
      queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
      
      onSuccess?.();
      return { success: true, clientSecret: data?.clientSecret };
    } catch (err) {
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current);
      }
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setResult({ state: 'error', error: errorMessage, paymentIntentId: null });
      toast.error('Payment failed');
      return { success: false, error: errorMessage };
    }
  }, [invoiceId, invoiceNumber, queryClient, onSuccess, triggerConfetti]);

  const reset = useCallback(() => {
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
    }
    setResult({ state: 'ready', error: null, paymentIntentId: null });
  }, []);

  const confirmSuccess = useCallback(() => {
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
    }
    setResult(prev => ({ ...prev, state: 'success' }));
    triggerConfetti();
    
    queryClient.invalidateQueries({ queryKey: ['portal-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    
    toast.success('Payment successful!', {
      description: `Invoice ${invoiceNumber} has been paid.`,
    });
    onSuccess?.();
  }, [invoiceNumber, queryClient, onSuccess, triggerConfetti]);

  return {
    state: result.state,
    error: result.error,
    paymentIntentId: result.paymentIntentId,
    pay,
    reset,
    confirmSuccess,
    formattedAmount: new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount),
  };
}
