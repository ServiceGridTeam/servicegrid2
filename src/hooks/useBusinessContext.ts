/**
 * Main business context hook
 * Provides active business, role, and navigation based on permissions
 * 
 * Resolution priority: URL param > profile > localStorage > primary > first
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  
  // URL helpers
  buildUrl: (path: string, businessId?: string) => string;
}

export function useBusinessContext(): BusinessContext {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: memberships = [], isLoading: membershipsLoading } = useBusinessMemberships();
  const queryClient = useQueryClient();
  const { prefetchBusiness, createHoverHandler } = usePrefetch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get business from URL param if present
  const urlBusinessId = searchParams.get('businessId');

  // Resolve the business ID with priority: URL > profile > localStorage > primary > first
  const resolvedBusinessId = useMemo(() => {
    // 1. URL param takes highest priority
    if (urlBusinessId && memberships.some(m => m.businessId === urlBusinessId && m.status === 'active')) {
      return urlBusinessId;
    }
    
    // 2. Profile's active business
    if (profile?.active_business_id) {
      return profile.active_business_id;
    }
    
    // 3. Legacy business_id field
    if (profile?.business_id) {
      return profile.business_id;
    }
    
    // 4. localStorage cached value
    const localBusiness = localState.getActiveBusiness();
    if (localBusiness && memberships.some(m => m.businessId === localBusiness && m.status === 'active')) {
      return localBusiness;
    }
    
    // 5. Primary membership
    const primary = memberships.find(m => m.isPrimary && m.status === 'active');
    if (primary) {
      return primary.businessId;
    }
    
    // 6. First active membership
    const first = memberships.find(m => m.status === 'active');
    return first?.businessId || null;
  }, [urlBusinessId, profile?.active_business_id, profile?.business_id, memberships]);

  // Resolve the role based on business
  const resolvedRole = useMemo(() => {
    if (!resolvedBusinessId) return null;
    
    // Check if we have a cached role
    if (profile?.active_role && profile.active_business_id === resolvedBusinessId) {
      return profile.active_role as AppRole;
    }
    
    // Get from membership
    const membership = memberships.find(m => m.businessId === resolvedBusinessId);
    return membership?.role || null;
  }, [resolvedBusinessId, profile?.active_role, profile?.active_business_id, memberships]);

  // Optimistic state management
  const {
    effectiveBusinessId,
    effectiveRole,
    isSwitching,
    startSwitch,
    setConfirming,
    confirmSwitch,
    failSwitch,
  } = useOptimisticBusiness(resolvedBusinessId, resolvedRole);

  // Handle URL param switching - sync profile if URL param differs from profile
  useEffect(() => {
    if (urlBusinessId && 
        urlBusinessId !== profile?.active_business_id && 
        memberships.some(m => m.businessId === urlBusinessId && m.status === 'active') &&
        user?.id &&
        !isSwitching) {
      // Silently switch to the URL business
      supabase.rpc('switch_active_business', { p_business_id: urlBusinessId })
        .then(({ error }) => {
          if (!error) {
            // Update local state
            const membership = memberships.find(m => m.businessId === urlBusinessId);
            if (membership) {
              localState.updateActiveContext(urlBusinessId, membership.role);
            }
            // Invalidate queries to reflect the change
            queryClient.invalidateQueries({ queryKey: ['profile'] });
          }
        });
    }
  }, [urlBusinessId, profile?.active_business_id, memberships, user?.id, isSwitching, queryClient]);

  // Find active membership
  const activeMembership = useMemo(() => {
    if (!effectiveBusinessId) return null;
    return memberships.find((m) => m.businessId === effectiveBusinessId) || null;
  }, [effectiveBusinessId, memberships]);

  // Derive active business name
  const activeBusinessName = activeMembership?.businessName || null;

  // Derive active role (prefer optimistic, then membership, then resolved)
  const activeRole: AppRole | null = effectiveRole || activeMembership?.role || resolvedRole;

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

  // Build URL with optional business ID
  const buildUrl = useCallback(
    (path: string, businessId?: string) => {
      const targetBusiness = businessId || effectiveBusinessId;
      
      // If switching to non-primary business, add to URL
      const primaryMembership = memberships.find(m => m.isPrimary);
      if (targetBusiness && targetBusiness !== primaryMembership?.businessId) {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('businessId', targetBusiness);
        return url.pathname + url.search;
      }
      
      return path;
    },
    [effectiveBusinessId, memberships]
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

      // Update URL if switching to non-primary
      const isPrimary = targetMembership.isPrimary;
      if (!isPrimary) {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('businessId', businessId);
        setSearchParams(newParams, { replace: true });
      } else {
        // Remove businessId from URL if switching to primary
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('businessId');
        setSearchParams(newParams, { replace: true });
      }

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
      searchParams,
      setSearchParams,
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
    buildUrl,
  };
}
