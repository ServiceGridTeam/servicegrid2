import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  setPortalActiveBusiness,
  setPortalActiveCustomer,
  invalidatePortalDashboardCache,
  getPortalSessionToken,
} from '@/lib/portalLocalState';
import { usePortalSession } from './usePortalSession';

export function useCustomerBusinesses() {
  const [isSwitching, setIsSwitching] = useState(false);
  const queryClient = useQueryClient();
  const { validateSession } = usePortalSession();

  const switchBusiness = useCallback(async (businessId: string, customerId: string) => {
    setIsSwitching(true);
    
    // Optimistic update - update local state immediately
    setPortalActiveBusiness(businessId);
    setPortalActiveCustomer(customerId);
    invalidatePortalDashboardCache();

    try {
      const sessionToken = getPortalSessionToken();
      if (!sessionToken) {
        throw new Error('No session token');
      }

      // Call edge function to update server-side session
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: {
          action: 'switch-context',
          sessionToken,
          businessId,
          customerId,
        },
      });

      if (error || data?.error) {
        console.error('Failed to switch business:', error || data?.error);
        // Rollback - revalidate session to get correct state
        await validateSession();
        return false;
      }

      // Invalidate all portal-related queries
      await queryClient.invalidateQueries({ queryKey: ['portal-dashboard'] });
      
      setIsSwitching(false);
      return true;
    } catch (err) {
      console.error('Switch business error:', err);
      await validateSession();
      setIsSwitching(false);
      return false;
    }
  }, [queryClient, validateSession]);

  return {
    switchBusiness,
    isSwitching,
  };
}

export default useCustomerBusinesses;
