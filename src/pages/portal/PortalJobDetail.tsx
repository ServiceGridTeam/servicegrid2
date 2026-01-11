import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, User, CheckCircle, Circle, AlertCircle, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { FeedbackPrompt } from '@/components/portal/FeedbackPrompt';
import { FeedbackForm } from '@/components/portal/FeedbackForm';
import { RescheduleRequestDialog } from '@/components/portal/RescheduleRequestDialog';
import { PortalPhotoGrid } from '@/components/portal/PortalPhotoGrid';
import { PortalGallerySection } from '@/components/portal/PortalGallerySection';
import { supabase } from '@/integrations/supabase/client';
import { usePortalSession } from '@/hooks/usePortalSession';
import { useCustomerFeedback } from '@/hooks/useCustomerFeedback';

export default function PortalJobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCustomerId, activeBusinessId } = usePortalSession();
  const { pendingJobs } = useCustomerFeedback();
  const [showReschedule, setShowReschedule] = useState(false);

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['portal-job', id],
    queryFn: async () => {
      if (!id || !activeCustomerId) return null;

      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customers(first_name, last_name)
        `)
        .eq('id', id)
        .eq('customer_id', activeCustomerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!activeCustomerId,
  });

  const canReschedule = job?.status === 'Scheduled' || job?.status === 'En Route';
  const needsFeedback = job?.status === 'Completed' &&
    pendingJobs.some(pj => pj.jobId === job.id);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'In Progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'En Route': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'Scheduled': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'Cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusSteps = ['Scheduled', 'En Route', 'In Progress', 'Completed'];
  const currentStepIndex = statusSteps.indexOf(job?.status || '');

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/portal/schedule')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Schedule
        </Button>
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Job Not Found</h3>
            <p className="text-sm text-muted-foreground">
              This job doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <motion.div whileTap={{ scale: 0.98 }} className="inline-block">
        <Button variant="ghost" onClick={() => navigate('/portal/schedule')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Schedule
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{job.title}</CardTitle>
                {job.description && (
                  <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                )}
              </div>
              <Badge variant="outline" className={getStatusColor(job.status)}>
                {job.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Timeline */}
            {job.status !== 'Cancelled' && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Status Timeline</h4>
                <div className="flex items-center justify-between">
                  {statusSteps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    
                    return (
                      <div key={step} className="flex flex-col items-center flex-1">
                        <motion.div
                          initial={false}
                          animate={{
                            scale: isCurrent ? 1.2 : 1,
                          }}
                          transition={{ type: 'spring', stiffness: 300 }}
                        >
                          {isCompleted ? (
                            <CheckCircle className={`h-6 w-6 ${isCurrent ? 'text-primary' : 'text-green-500'}`} />
                          ) : (
                            <Circle className="h-6 w-6 text-muted-foreground/30" />
                          )}
                        </motion.div>
                        <span className={`text-xs mt-1 ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Job Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              {job.scheduled_start && (
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Scheduled</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(job.scheduled_start), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(job.scheduled_start), 'h:mm a')}
                      {job.scheduled_end && ` - ${format(new Date(job.scheduled_end), 'h:mm a')}`}
                    </p>
                  </div>
                </div>
              )}

              {job.address_line1 && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {job.address_line1}
                      {job.city && `, ${job.city}`}
                      {job.state && `, ${job.state}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes visible to customer */}
            {job.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium text-sm mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{job.notes}</p>
                </div>
              </>
            )}

            {/* Job Photos - Privacy-safe display */}
            <Separator />
            <PortalPhotoGrid jobId={job.id} businessId={activeBusinessId || ''} />

            {/* Gallery Access Section */}
            <PortalGallerySection jobId={job.id} />

            {/* Reschedule Button */}
            {canReschedule && (
              <>
                <Separator />
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowReschedule(true)}
                  >
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Request Reschedule
                  </Button>
                </motion.div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Reschedule Dialog */}
      {job && (
        <RescheduleRequestDialog
          open={showReschedule}
          onOpenChange={setShowReschedule}
          jobId={job.id}
          jobTitle={job.title}
          onSuccess={() => setShowReschedule(false)}
        />
      )}

      {/* Feedback Section */}
      {needsFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rate Your Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <FeedbackForm
                jobId={job.id}
                jobTitle={job.title}
                onComplete={() => navigate('/portal/schedule')}
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
