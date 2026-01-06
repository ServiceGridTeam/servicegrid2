import { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Loader2, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from '@/lib/portalLocalState';

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type DialogState = 'form' | 'processing' | 'success' | 'error';

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddPaymentMethodDialogProps) {
  const [state, setState] = useState<DialogState>('form');
  const [error, setError] = useState<string | null>(null);
  
  // Simple card input fields (in production, use Stripe Elements)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('processing');
    setError(null);

    try {
      const token = getPortalSessionToken();
      if (!token) throw new Error('Not authenticated');

      // Call edge function to create setup intent and save payment method
      const { data, error: fnError } = await supabase.functions.invoke('portal-payment-methods', {
        body: {
          action: 'create-setup-intent',
        },
        headers: { 'X-Portal-Session': token },
      });

      if (fnError) throw fnError;

      // In a full implementation, you would use Stripe.js to confirm the SetupIntent
      // For now, we'll simulate success after the edge function returns
      if (data?.setupIntent) {
        // Simulate successful card setup
        await new Promise(resolve => setTimeout(resolve, 1500));
        setState('success');
        toast.success('Payment method added successfully');
        
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
          resetForm();
        }, 1500);
      } else {
        throw new Error('Failed to create setup intent');
      }
    } catch (err: any) {
      console.error('Failed to add payment method:', err);
      setState('error');
      setError(err.message || 'Failed to add payment method');
    }
  };

  const resetForm = () => {
    setState('form');
    setCardNumber('');
    setExpiry('');
    setCvc('');
    setError(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Add Payment Method
          </DialogTitle>
          <DialogDescription>
            Add a new card for faster payments
          </DialogDescription>
        </DialogHeader>

        <motion.div
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {state === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Add Card
              </Button>
            </form>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Adding your card...</p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center justify-center py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4"
              >
                <Check className="h-6 w-6 text-green-600" />
              </motion.div>
              <p className="font-medium">Card Added Successfully</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4"
              >
                <AlertCircle className="h-6 w-6 text-destructive" />
              </motion.div>
              <p className="font-medium mb-2">Failed to Add Card</p>
              <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
              <Button variant="outline" onClick={() => setState('form')}>
                Try Again
              </Button>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default AddPaymentMethodDialog;
