import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Plus, Calendar, ClipboardList, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FeedbackPrompt } from '@/components/portal/FeedbackPrompt';
import { supabase } from '@/integrations/supabase/client';
import { usePortalSession } from '@/hooks/usePortalSession';
import { getPortalSessionToken } from '@/lib/portalLocalState';

export default function PortalSchedule() {
  const navigate = useNavigate();
  const { activeBusinessId, activeCustomerId } = usePortalSession();
  const [activeTab, setActiveTab] = useState('jobs');

  // Fetch jobs
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['portal-jobs', activeCustomerId, activeBusinessId],
    queryFn: async () => {
      if (!activeCustomerId || !activeBusinessId) return [];
      
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', activeCustomerId)
        .eq('business_id', activeBusinessId)
        .order('scheduled_start', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeCustomerId && !!activeBusinessId,
  });

  // Fetch service requests
  const { data: serviceRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['portal-service-requests', activeCustomerId],
    queryFn: async () => {
      const token = getPortalSessionToken();
      if (!token) return { requests: [] };

      const { data, error } = await supabase.functions.invoke('portal-service-requests', {
        body: { action: 'list' },
        headers: { 'X-Portal-Session': token },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!activeCustomerId,
  });

  const upcomingJobs = jobs.filter(j => 
    j.scheduled_start && new Date(j.scheduled_start) >= new Date() && 
    j.status !== 'Completed' && j.status !== 'Cancelled'
  );
  
  const activeJobs = jobs.filter(j => 
    j.status === 'In Progress' || j.status === 'En Route'
  );
  
  const completedJobs = jobs.filter(j => j.status === 'Completed');

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

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'approved': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'declined': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'converted': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <Button onClick={() => navigate('/portal/request-service')}>
          <Plus className="h-4 w-4 mr-2" />
          Request Service
        </Button>
      </div>

      <FeedbackPrompt />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="jobs" className="gap-2">
            <Calendar className="h-4 w-4" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Service Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6 mt-6">
          {jobsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Active Jobs */}
              {activeJobs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Active Now</h3>
                  {activeJobs.map((job, index) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      index={index}
                      getStatusColor={getStatusColor}
                      onClick={() => navigate(`/portal/jobs/${job.id}`)}
                    />
                  ))}
                </div>
              )}

              {/* Upcoming Jobs */}
              {upcomingJobs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Upcoming</h3>
                  {upcomingJobs.map((job, index) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      index={index}
                      getStatusColor={getStatusColor}
                      onClick={() => navigate(`/portal/jobs/${job.id}`)}
                    />
                  ))}
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Completed</h3>
                  {completedJobs.slice(0, 5).map((job, index) => (
                    <JobCard 
                      key={job.id} 
                      job={job} 
                      index={index}
                      getStatusColor={getStatusColor}
                      onClick={() => navigate(`/portal/jobs/${job.id}`)}
                    />
                  ))}
                </div>
              )}

              {jobs.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Jobs Yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Request a service to get started.
                    </p>
                    <Button onClick={() => navigate('/portal/request-service')}>
                      Request Service
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4 mt-6">
          {requestsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (serviceRequests?.requests?.length || 0) > 0 ? (
            serviceRequests.requests.map((request: any, index: number) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-muted-foreground">
                            {request.request_number}
                          </span>
                          <Badge variant="outline" className={getRequestStatusColor(request.status)}>
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{request.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{format(new Date(request.created_at), 'MMM d, yyyy')}</span>
                          {request.service_type && (
                            <span className="capitalize">{request.service_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Service Requests</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't submitted any service requests yet.
                </p>
                <Button onClick={() => navigate('/portal/request-service')}>
                  Request Service
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface JobCardProps {
  job: any;
  index: number;
  getStatusColor: (status: string) => string;
  onClick: () => void;
}

function JobCard({ job, index, getStatusColor, onClick }: JobCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{job.title}</h4>
                <Badge variant="outline" className={getStatusColor(job.status)}>
                  {job.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {job.scheduled_start && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(new Date(job.scheduled_start), 'MMM d, h:mm a')}</span>
                  </div>
                )}
                {job.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[200px]">{job.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
