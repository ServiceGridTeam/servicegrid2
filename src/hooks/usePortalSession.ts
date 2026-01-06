import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getPortalContext,
  setPortalSessionToken,
  setPortalActiveBusiness,
  setPortalActiveCustomer,
  setPortalCustomerAccountId,
  setPortalBusinesses,
  clearPortalLocalState,
  StoredPortalBusiness,
} from '@/lib/portalLocalState';

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  customerAccountId: string | null;
  activeBusinessId: string | null;
  activeCustomerId: string | null;
  businesses: StoredPortalBusiness[];
  email: string | null;
}

export function usePortalSession() {
  const [state, setState] = useState<SessionState>(() => {
    // Initialize from localStorage for instant hydration
    const context = getPortalContext();
    return {
      isAuthenticated: !!context.sessionToken,
      isLoading: !!context.sessionToken, // Only loading if we have a token to validate
      customerAccountId: context.customerAccountId,
      activeBusinessId: context.activeBusinessId,
      activeCustomerId: context.activeCustomerId,
      businesses: context.businesses,
      email: null,
    };
  });

  const validateSession = useCallback(async () => {
    const context = getPortalContext();
    if (!context.sessionToken) {
      setState(prev => ({ ...prev, isAuthenticated: false, isLoading: false }));
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'validate-session', sessionToken: context.sessionToken },
      });

      if (error || data?.error || !data?.valid) {
        clearPortalLocalState();
        setState({
          isAuthenticated: false,
          isLoading: false,
          customerAccountId: null,
          activeBusinessId: null,
          activeCustomerId: null,
          businesses: [],
          email: null,
        });
        return false;
      }

      // Update state with validated data
      setPortalCustomerAccountId(data.customerAccountId);
      setPortalActiveBusiness(data.activeBusinessId);
      setPortalActiveCustomer(data.activeCustomerId);
      if (data.businesses) {
        setPortalBusinesses(data.businesses);
      }

      setState({
        isAuthenticated: true,
        isLoading: false,
        customerAccountId: data.customerAccountId,
        activeBusinessId: data.activeBusinessId,
        activeCustomerId: data.activeCustomerId,
        businesses: data.businesses || [],
        email: data.email,
      });

      return true;
    } catch (err) {
      console.error('Session validation error:', err);
      clearPortalLocalState();
      setState({
        isAuthenticated: false,
        isLoading: false,
        customerAccountId: null,
        activeBusinessId: null,
        activeCustomerId: null,
        businesses: [],
        email: null,
      });
      return false;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const context = getPortalContext();
    if (!context.sessionToken) return false;

    try {
      const { data, error } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'refresh-session', sessionToken: context.sessionToken },
      });

      if (error || data?.error) {
        return false;
      }

      return true;
    } catch (err) {
      console.error('Session refresh error:', err);
      return false;
    }
  }, []);

  // Validate session on mount
  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Refresh session periodically (every 24 hours)
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const interval = setInterval(() => {
      refreshSession();
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, refreshSession]);

  return {
    ...state,
    validateSession,
    refreshSession,
  };
}
