import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  listPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  createSetupIntent,
  PaymentMethod,
} from '@/lib/portalApi';

export function usePaymentMethods() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['portal-payment-methods'],
    queryFn: async () => {
      const { data, error } = await listPaymentMethods();
      if (error) throw new Error(error.message);
      return data as PaymentMethod[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const { error } = await setDefaultPaymentMethod(paymentMethodId);
      if (error) throw new Error(error.message);
    },
    onMutate: async (paymentMethodId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['portal-payment-methods'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<PaymentMethod[]>(['portal-payment-methods']);

      // Optimistically update
      queryClient.setQueryData<PaymentMethod[]>(['portal-payment-methods'], (old) =>
        old?.map((pm) => ({
          ...pm,
          isDefault: pm.id === paymentMethodId,
        }))
      );

      return { previous };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['portal-payment-methods'], context.previous);
      }
      toast.error('Failed to set default payment method');
    },
    onSuccess: () => {
      toast.success('Default payment method updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-payment-methods'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      const { error } = await deletePaymentMethod(paymentMethodId);
      if (error) throw new Error(error.message);
    },
    onMutate: async (paymentMethodId) => {
      await queryClient.cancelQueries({ queryKey: ['portal-payment-methods'] });

      const previous = queryClient.getQueryData<PaymentMethod[]>(['portal-payment-methods']);

      // Optimistically remove
      queryClient.setQueryData<PaymentMethod[]>(['portal-payment-methods'], (old) =>
        old?.filter((pm) => pm.id !== paymentMethodId)
      );

      return { previous };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['portal-payment-methods'], context.previous);
      }
      toast.error('Failed to delete payment method');
    },
    onSuccess: () => {
      toast.success('Payment method removed');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-payment-methods'] });
    },
  });

  const createSetupIntentMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await createSetupIntent();
      if (error) throw new Error(error.message);
      return data;
    },
    onError: () => {
      toast.error('Failed to initialize card setup');
    },
  });

  return {
    paymentMethods: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    setDefault: setDefaultMutation.mutate,
    isSettingDefault: setDefaultMutation.isPending,
    remove: deleteMutation.mutate,
    isRemoving: deleteMutation.isPending,
    createSetupIntent: createSetupIntentMutation.mutateAsync,
    isCreatingSetupIntent: createSetupIntentMutation.isPending,
  };
}
