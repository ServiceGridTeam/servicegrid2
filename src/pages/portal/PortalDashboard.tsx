import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionItemsWidget } from '@/components/portal/ActionItemsWidget';
import { FinancialSummaryWidget } from '@/components/portal/FinancialSummaryWidget';
import { QuickActionsCard } from '@/components/portal/QuickActionsCard';
import { usePortalDashboard } from '@/hooks/usePortalDashboard';
import { usePortalSession } from '@/hooks/usePortalSession';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function PortalDashboard() {
  const { businesses, activeBusinessId } = usePortalSession();
  const { data, isLoading } = usePortalDashboard();
  
  const currentBusiness = businesses.find(b => b.businessId === activeBusinessId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-primary/20 text-primary';
      case 'scheduled':
        return 'bg-secondary text-secondary-foreground';
      case 'completed':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatJobDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'TBD';
    }
  };

  const formatJobTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="text-muted-foreground">
          Your dashboard for {currentBusiness?.businessName || 'your account'}
        </p>
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Action Items */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <ActionItemsWidget 
            pendingQuotes={data.pendingQuotes}
            unpaidInvoices={data.unpaidInvoices}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Financial Summary */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <FinancialSummaryWidget 
            totalOwed={data.totalOwed}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <QuickActionsCard />
        </motion.div>
      </div>

      {/* Upcoming Jobs */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Upcoming Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : data.upcomingJobs.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No upcoming jobs scheduled
              </p>
            ) : (
              <div className="space-y-3">
                {data.upcomingJobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">
                        {job.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatJobDate(job.scheduledDate)}</span>
                        {formatJobTime(job.scheduledDate) && (
                          <>
                            <Clock className="h-3 w-3 ml-2" />
                            <span>{formatJobTime(job.scheduledDate)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default PortalDashboard;
