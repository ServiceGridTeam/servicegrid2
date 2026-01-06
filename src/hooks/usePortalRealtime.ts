import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPortalActiveBusiness, getPortalActiveCustomer, setPortalUnreadCount, getPortalUnreadCount } from '@/lib/portalLocalState';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export function usePortalRealtime() {
  const queryClient = useQueryClient();
  const activeBusinessId = getPortalActiveBusiness();
  const activeCustomerId = getPortalActiveCustomer();

  const handleJobChange = useCallback((payload: RealtimePayload) => {
    const job = payload.new as { id: string; title: string; status: string; customer_id: string };
    
    // Only process if it's for the active customer
    if (job.customer_id !== activeCustomerId) return;

    // Invalidate job-related queries
    queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['portal-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['portal-job', job.id] });

    // Show toast for status changes
    if (payload.eventType === 'UPDATE') {
      const oldJob = payload.old as { status: string };
      if (oldJob.status !== job.status) {
        const statusMessages: Record<string, string> = {
          'in_progress': 'Your job has started',
          'completed': 'Your job has been completed',
          'on_the_way': 'Technician is on the way',
        };
        const message = statusMessages[job.status];
        if (message) {
          toast.info(message, { description: job.title });
        }
      }
    }
  }, [activeCustomerId, queryClient]);

  const handleQuoteChange = useCallback((payload: RealtimePayload) => {
    const quote = payload.new as { id: string; customer_id: string };
    
    // Only process if it's for the active customer
    if (quote.customer_id !== activeCustomerId) return;

    // Invalidate quote-related queries
    queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
    queryClient.invalidateQueries({ queryKey: ['portal-quote', quote.id] });

    // Show toast for new quotes
    if (payload.eventType === 'INSERT') {
      toast.info('New quote available', { description: 'A new quote has been sent to you' });
      // Increment unread count
      const currentCount = getPortalUnreadCount();
      setPortalUnreadCount(currentCount + 1);
    }
  }, [activeCustomerId, queryClient]);

  const handleInvoiceChange = useCallback((payload: RealtimePayload) => {
    const invoice = payload.new as { id: string; customer_id: string; status: string };
    
    // Only process if it's for the active customer
    if (invoice.customer_id !== activeCustomerId) return;

    // Invalidate invoice-related queries
    queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['portal-documents'] });
    queryClient.invalidateQueries({ queryKey: ['portal-invoice', invoice.id] });

    // Show toast for new invoices
    if (payload.eventType === 'INSERT') {
      toast.info('New invoice available', { description: 'A new invoice has been sent to you' });
      const currentCount = getPortalUnreadCount();
      setPortalUnreadCount(currentCount + 1);
    }
  }, [activeCustomerId, queryClient]);

  const handleServiceRequestChange = useCallback((payload: RealtimePayload) => {
    const request = payload.new as { id: string; customer_id: string; status: string };
    
    // Only process if it's for the active customer
    if (request.customer_id !== activeCustomerId) return;

    // Invalidate service request queries
    queryClient.invalidateQueries({ queryKey: ['portal-service-requests'] });
    queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });

    // Show toast for status changes
    if (payload.eventType === 'UPDATE') {
      const oldRequest = payload.old as { status: string };
      if (oldRequest.status !== request.status) {
        const statusMessages: Record<string, string> = {
          'approved': 'Your service request has been approved',
          'declined': 'Your service request has been declined',
          'converted': 'Your service request has been scheduled',
        };
        const message = statusMessages[request.status];
        if (message) {
          toast.info(message);
        }
      }
    }
  }, [activeCustomerId, queryClient]);

  useEffect(() => {
    if (!activeBusinessId || !activeCustomerId) return;

    // Subscribe to jobs table changes
    const jobsChannel = supabase
      .channel('portal-jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => handleJobChange(payload as unknown as RealtimePayload)
      )
      .subscribe();

    // Subscribe to quotes table changes
    const quotesChannel = supabase
      .channel('portal-quotes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => handleQuoteChange(payload as unknown as RealtimePayload)
      )
      .subscribe();

    // Subscribe to invoices table changes
    const invoicesChannel = supabase
      .channel('portal-invoices-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => handleInvoiceChange(payload as unknown as RealtimePayload)
      )
      .subscribe();

    // Subscribe to service requests table changes
    const requestsChannel = supabase
      .channel('portal-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_service_requests',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => handleServiceRequestChange(payload as unknown as RealtimePayload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [activeBusinessId, activeCustomerId, handleJobChange, handleQuoteChange, handleInvoiceChange, handleServiceRequestChange]);
}
