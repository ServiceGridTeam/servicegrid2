import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Loader2, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from '@/lib/portalLocalState';

interface RescheduleRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
}

const TIME_PREFERENCES = [
  { value: 'morning', label: 'Morning', description: '8am - 12pm' },
  { value: 'afternoon', label: 'Afternoon', description: '12pm - 5pm' },
  { value: 'evening', label: 'Evening', description: '5pm - 8pm' },
];

type DialogState = 'form' | 'submitting' | 'success';

export function RescheduleRequestDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onSuccess,
}: RescheduleRequestDialogProps) {
  const [state, setState] = useState<DialogState>('form');
  const [preferredDate, setPreferredDate] = useState<Date | undefined>();
  const [timePreference, setTimePreference] = useState<string>('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!preferredDate) {
      toast.error('Please select a preferred date');
      return;
    }

    setState('submitting');

    try {
      const token = getPortalSessionToken();
      if (!token) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('portal-service-requests', {
        body: {
          action: 'create',
          serviceType: 'reschedule',
          description: `Reschedule request for: ${jobTitle}\n\nPreferred date: ${format(preferredDate, 'MMMM d, yyyy')}\nTime preference: ${timePreference || 'Flexible'}\n\nReason: ${reason || 'Not specified'}`,
          urgency: 'normal',
          preferredTimes: timePreference ? [timePreference] : [],
          metadata: {
            type: 'reschedule',
            originalJobId: jobId,
            preferredDate: preferredDate.toISOString(),
            timePreference,
          },
        },
        headers: { 'X-Portal-Session': token },
      });

      if (error) throw error;

      setState('success');
      toast.success('Reschedule request submitted');

      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to submit reschedule request:', err);
      toast.error(err.message || 'Failed to submit request');
      setState('form');
    }
  };

  const resetForm = () => {
    setState('form');
    setPreferredDate(undefined);
    setTimePreference('');
    setReason('');
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Reschedule
          </DialogTitle>
          <DialogDescription>
            Request a new date and time for "{jobTitle}"
          </DialogDescription>
        </DialogHeader>

        <motion.div
          key={state}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {state === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Preferred Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !preferredDate && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {preferredDate ? format(preferredDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={preferredDate}
                      onSelect={setPreferredDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Preferred Time</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_PREFERENCES.map((pref) => (
                    <motion.button
                      key={pref.value}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTimePreference(
                        timePreference === pref.value ? '' : pref.value
                      )}
                      className={cn(
                        'flex flex-col items-center p-3 rounded-lg border transition-colors',
                        timePreference === pref.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <Clock className="h-4 w-4 mb-1" />
                      <span className="text-sm font-medium">{pref.label}</span>
                      <span className="text-xs text-muted-foreground">{pref.description}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Let us know why you need to reschedule..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <motion.div whileTap={{ scale: 0.98 }}>
                <Button type="submit" className="w-full">
                  Submit Request
                </Button>
              </motion.div>
            </form>
          )}

          {state === 'submitting' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Submitting your request...</p>
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
              <p className="font-medium">Request Submitted</p>
              <p className="text-sm text-muted-foreground text-center mt-1">
                We'll contact you to confirm the new date
              </p>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default RescheduleRequestDialog;
