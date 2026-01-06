/**
 * Main business context hook
 * Provides active business, role, and navigation based on permissions
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useBusinessMemberships, type BusinessMembership } from './useBusinessMemberships';
import { useOptimisticBusiness } from './useOptimisticBusiness';
import { usePrefetch } from './usePrefetch';
import * as localState from '@/lib/localState';
import { getNavForRole } from '@/lib/precompute';
import { BUSINESS_SCOPED_QUERY_KEYS, type AppRole } from '@/lib/permissions';
import type { NavGroup } from '@/lib/navigation';
import { toast } from 'sonner';

export interface BusinessContext {
  // Current state
  activeBusinessId: string | null;
  activeBusinessName: string | null;
  activeRole: AppRole | null;
  memberships: BusinessMembership[];
  
  // Loading states
  isLoading: boolean;
  isSwitching: boolean;
  
  // Derived data
  navGroups: NavGroup[];
  hasMembership: (businessId: string) => boolean;
  
  // Actions
  switchBusiness: (businessId: string) => Promise<void>;
  prefetchBusiness: (businessId: string) => void;
  createHoverHandler: (businessId: string) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}

export function useBusinessContext(): BusinessContext {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: memberships = [], isLoading: membershipsLoading } = useBusinessMemberships();
  const queryClient = useQueryClient();
  const { prefetchBusiness, createHoverHandler } = usePrefetch();

  // Get current business from profile
  const currentBusinessId = profile?.active_business_id || profile?.business_id || null;
  const currentRole = (profile?.active_role as AppRole) || null;

  // Optimistic state management
  const {
    effectiveBusinessId,
    effectiveRole,
    isSwitching,
    startSwitch,
    setConfirming,
    confirmSwitch,
    failSwitch,
  } = useOptimisticBusiness(currentBusinessId, currentRole);

  // Find active membership
  const activeMembership = useMemo(() => {
    if (!effectiveBusinessId) return null;
    return memberships.find((m) => m.businessId === effectiveBusinessId) || null;
  }, [effectiveBusinessId, memberships]);

  // Derive active business name
  const activeBusinessName = activeMembership?.businessName || null;

  // Derive active role (prefer optimistic, then membership, then profile)
  const activeRole: AppRole | null = effectiveRole || activeMembership?.role || currentRole;

  // Get navigation groups for current role
  const navGroups = useMemo(() => {
    return getNavForRole(activeRole);
  }, [activeRole]);

  // Check if user has membership in a business
  const hasMembership = useCallback(
    (businessId: string) => {
      return memberships.some((m) => m.businessId === businessId && m.status === 'active');
    },
    [memberships]
  );

  // Switch business
  const switchBusiness = useCallback(
    async (businessId: string) => {
      if (!user?.id) return;
      if (businessId === effectiveBusinessId) return;

      // Find target membership
      const targetMembership = memberships.find((m) => m.businessId === businessId);
      if (!targetMembership) {
        toast.error('You do not have access to this business');
        return;
      }

      // Start optimistic update
      const { rollback } = startSwitch(businessId, targetMembership.role);

      // Update localStorage immediately
      localState.updateActiveContext(businessId, targetMembership.role);

      try {
        setConfirming();

        // Call server function to switch
        const { error } = await supabase.rpc('switch_active_business', {
          p_business_id: businessId,
        });

        if (error) throw error;

        // Invalidate all business-scoped queries
        BUSINESS_SCOPED_QUERY_KEYS.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });

        // Refetch profile to get updated active_business_id
        queryClient.invalidateQueries({ queryKey: ['profile'] });

        confirmSwitch();
        toast.success(`Switched to ${targetMembership.businessName}`);
      } catch (error) {
        console.error('Error switching business:', error);
        rollback();
        failSwitch();
        toast.error('Failed to switch business');
      }
    },
    [
      user?.id,
      effectiveBusinessId,
      memberships,
      startSwitch,
      setConfirming,
      confirmSwitch,
      failSwitch,
      queryClient,
    ]
  );

  return {
    activeBusinessId: effectiveBusinessId,
    activeBusinessName,
    activeRole,
    memberships,
    isLoading: profileLoading || membershipsLoading,
    isSwitching,
    navGroups,
    hasMembership,
    switchBusiness,
    prefetchBusiness,
    createHoverHandler,
  };
}
