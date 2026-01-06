import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOptimisticPayment } from '@/hooks/useOptimisticPayment';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { useState } from 'react';

interface InvoicePaymentProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  onSuccess?: () => void;
}

export function InvoicePayment({
  invoiceId,
  invoiceNumber,
  amount,
  onSuccess,
}: InvoicePaymentProps) {
  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>();
  
  const { paymentMethods, isLoading: loadingMethods } = usePaymentMethods();
  const { state, error, pay, reset, formattedAmount } = useOptimisticPayment({
    invoiceId,
    invoiceNumber,
    amount,
    onSuccess,
  });

  const handlePay = async () => {
    await pay(selectedMethodId);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <AnimatePresence mode="wait">
          {state === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Amount Due</p>
                <p className="text-3xl font-bold">{formattedAmount}</p>
              </div>

              {!loadingMethods && paymentMethods.length > 0 && (
                <PaymentMethodSelector
                  methods={paymentMethods}
                  selectedId={selectedMethodId}
                  onSelect={setSelectedMethodId}
                />
              )}

              <Button
                onClick={handlePay}
                className="w-full gap-2"
                size="lg"
              >
                <CreditCard className="h-4 w-4" />
                Pay {formattedAmount}
              </Button>

              {!loadingMethods && paymentMethods.length === 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  You'll be redirected to enter your card details
                </p>
              )}
            </motion.div>
          )}

          {state === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <CreditCard className="h-12 w-12 text-primary" />
              </motion.div>
              <p className="mt-4 text-lg font-medium">Processing payment...</p>
              <p className="text-sm text-muted-foreground">Please wait</p>
            </motion.div>
          )}

          {state === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
              >
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </motion.div>
              <h3 className="mt-4 text-xl font-semibold text-green-600 dark:text-green-400">
                Payment Successful!
              </h3>
              <p className="text-sm text-muted-foreground">
                Invoice {invoiceNumber} has been paid
              </p>
              <p className="mt-2 text-2xl font-bold">{formattedAmount}</p>
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-destructive">
                Payment Failed
              </h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                {error || 'Something went wrong. Please try again.'}
              </p>
              <Button onClick={reset} variant="outline" className="mt-4">
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
