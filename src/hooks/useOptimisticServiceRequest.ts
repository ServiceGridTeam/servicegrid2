import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPortalSessionToken } from '@/lib/portalLocalState';
import { toast } from 'sonner';

interface ServiceRequestData {
  serviceType?: string;
  description: string;
  urgency: 'low' | 'normal' | 'high' | 'emergency';
  preferredTimes?: string[];
  preferredDates?: string[];
  photoUrls?: string[];
}

interface ServiceRequestResponse {
  id: string;
  requestNumber: string;
}

export function useOptimisticServiceRequest() {
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async (data: ServiceRequestData): Promise<ServiceRequestResponse> => {
      const token = getPortalSessionToken();
      if (!token) throw new Error('Not authenticated');

      const { data: response, error } = await supabase.functions.invoke('portal-service-requests', {
        body: { action: 'submit', ...data },
        headers: { 'X-Portal-Session': token },
      });

      if (error || response?.error) {
        throw new Error(response?.error || error?.message || 'Failed to submit request');
      }

      return response;
    },
    onMutate: async (newRequest) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['portal-service-requests'] });

      // Snapshot previous value
      const previousRequests = queryClient.getQueryData(['portal-service-requests']);

      // Optimistically add to the list with temp ID
      const tempRequest = {
        id: `temp-${Date.now()}`,
        request_number: 'SR-XXXXX',
        status: 'pending',
        service_type: newRequest.serviceType,
        description: newRequest.description,
        urgency: newRequest.urgency,
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      queryClient.setQueryData(['portal-service-requests'], (old: any) => ({
        requests: [tempRequest, ...(old?.requests || [])],
      }));

      // Show immediate success toast
      toast.success('Service request submitted!');

      return { previousRequests };
    },
    onError: (err, _newRequest, context) => {
      // Rollback on error
      if (context?.previousRequests) {
        queryClient.setQueryData(['portal-service-requests'], context.previousRequests);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    },
    onSuccess: (response) => {
      // Replace optimistic entry with real one
      queryClient.invalidateQueries({ queryKey: ['portal-service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
    },
  });

  return {
    submit: submitMutation.mutate,
    submitAsync: submitMutation.mutateAsync,
    isPending: submitMutation.isPending,
    error: submitMutation.error,
  };
}
