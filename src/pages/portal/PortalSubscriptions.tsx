import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { RefreshCw, ChevronDown, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePortalSession } from '@/hooks/usePortalSession';
import { usePortalSubscriptions, usePortalSkipVisit, PortalSubscription, PortalSchedule } from '@/hooks/usePortalSubscription';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  draft: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
};

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'week',
  biweekly: '2 weeks',
  monthly: 'month',
  quarterly: 'quarter',
  annually: 'year',
};

export function PortalSubscriptions() {
  const { activeCustomerId, activeBusinessId } = usePortalSession();
  const { data: subscriptions, isLoading } = usePortalSubscriptions(activeCustomerId ?? undefined, activeBusinessId ?? undefined);
  const skipVisitMutation = usePortalSkipVisit(activeCustomerId ?? undefined);
  
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [skipDialogOpen, setSkipDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<{ schedule: PortalSchedule; subscriptionName: string } | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const toggleExpand = (subId: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const handleSkipClick = (schedule: PortalSchedule, subscriptionName: string) => {
    setSelectedSchedule({ schedule, subscriptionName });
    setSkipReason('');
    setSkipDialogOpen(true);
  };

  const handleSkipConfirm = async () => {
    if (!selectedSchedule) return;
    
    await skipVisitMutation.mutateAsync({
      scheduleId: selectedSchedule.schedule.id,
      reason: skipReason || undefined,
    });
    
    setSkipDialogOpen(false);
    setSelectedSchedule(null);
    setSkipReason('');
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'TBD';
    }
  };

  const formatPrice = (price: number, frequency: string) => {
    const label = FREQUENCY_LABELS[frequency] || frequency;
    return `$${price.toFixed(2)}/${label}`;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-muted-foreground" />
          My Subscriptions
        </h1>
        <p className="text-muted-foreground">
          View and manage your recurring service subscriptions
        </p>
      </motion.div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!subscriptions || subscriptions.length === 0) && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No Subscriptions</h3>
              <p className="text-muted-foreground text-sm text-center">
                You don't have any active subscriptions at this time.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Subscription cards */}
      {!isLoading && subscriptions && subscriptions.length > 0 && (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <motion.div key={sub.id} variants={itemVariants}>
              <SubscriptionCard
                subscription={sub}
                isExpanded={expandedSubs.has(sub.id)}
                onToggle={() => toggleExpand(sub.id)}
                onSkipVisit={handleSkipClick}
                formatDate={formatDate}
                formatPrice={formatPrice}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Skip Visit Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Scheduled Visit</DialogTitle>
            <DialogDescription>
              {selectedSchedule && (
                <>
                  Are you sure you want to skip the visit scheduled for{' '}
                  <span className="font-medium">{formatDate(selectedSchedule.schedule.scheduled_date)}</span>
                  {' '}for <span className="font-medium">{selectedSchedule.subscriptionName}</span>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Reason (optional)
            </label>
            <Textarea
              placeholder="Let us know why you're skipping this visit..."
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {skipReason.length}/500 characters
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSkipConfirm}
              disabled={skipVisitMutation.isPending}
            >
              {skipVisitMutation.isPending ? 'Skipping...' : 'Skip Visit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

interface SubscriptionCardProps {
  subscription: PortalSubscription;
  isExpanded: boolean;
  onToggle: () => void;
  onSkipVisit: (schedule: PortalSchedule, subscriptionName: string) => void;
  formatDate: (date: string) => string;
  formatPrice: (price: number, frequency: string) => string;
}

function SubscriptionCard({
  subscription,
  isExpanded,
  onToggle,
  onSkipVisit,
  formatDate,
  formatPrice,
}: SubscriptionCardProps) {
  const pendingSchedules = subscription.upcoming_schedules?.filter(s => s.status === 'pending') || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              {subscription.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatPrice(subscription.price, subscription.frequency)}
              {subscription.next_service_date && (
                <> • Next service: {formatDate(subscription.next_service_date)}</>
              )}
            </p>
          </div>
          <Badge className={STATUS_STYLES[subscription.status] || STATUS_STYLES.draft}>
            {subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {pendingSchedules.length > 0 ? (
          <Collapsible open={isExpanded} onOpenChange={onToggle}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start p-0 h-auto hover:bg-transparent">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span>Upcoming Visits ({pendingSchedules.length})</span>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2 border-l-2 border-border pl-4 ml-1">
                {pendingSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/30"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatDate(schedule.scheduled_date)}</span>
                      <Badge variant="outline" className="text-xs">
                        {schedule.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSkipVisit(schedule, subscription.name)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Skip
                    </Button>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <AlertCircle className="h-4 w-4" />
            <span>No upcoming visits scheduled</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PortalSubscriptions;
