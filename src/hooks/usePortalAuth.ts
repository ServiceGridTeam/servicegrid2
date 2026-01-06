import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getPortalSessionToken,
  setPortalSessionToken,
  setPortalActiveBusiness,
  setPortalActiveCustomer,
  setPortalCustomerAccountId,
  setPortalBusinesses,
  clearPortalLocalState,
  StoredPortalBusiness,
} from '@/lib/portalLocalState';

interface AuthResult {
  success: boolean;
  error?: string;
}

interface LoginResult extends AuthResult {
  sessionToken?: string;
  customerAccountId?: string;
  activeBusinessId?: string;
  activeCustomerId?: string;
  businesses?: StoredPortalBusiness[];
}

export function usePortalAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'generate-magic-link', email },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      return { success: true };
    } catch (err: any) {
      const message = err.message || 'Failed to send magic link';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateMagicLink = useCallback(async (token: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'validate-magic-link', token },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Store session data
      if (data.sessionToken) {
        setPortalSessionToken(data.sessionToken);
        setPortalCustomerAccountId(data.customerAccountId);
        setPortalActiveBusiness(data.activeBusinessId);
        setPortalActiveCustomer(data.activeCustomerId);
        if (data.businesses) {
          setPortalBusinesses(data.businesses);
        }
      }

      return {
        success: true,
        sessionToken: data.sessionToken,
        customerAccountId: data.customerAccountId,
        activeBusinessId: data.activeBusinessId,
        activeCustomerId: data.activeCustomerId,
        businesses: data.businesses,
      };
    } catch (err: any) {
      const message = err.message || 'Invalid or expired link';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithPassword = useCallback(async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'login-password', email, password },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Store session data
      if (data.sessionToken) {
        setPortalSessionToken(data.sessionToken);
        setPortalCustomerAccountId(data.customerAccountId);
        setPortalActiveBusiness(data.activeBusinessId);
        setPortalActiveCustomer(data.activeCustomerId);
        if (data.businesses) {
          setPortalBusinesses(data.businesses);
        }
      }

      return {
        success: true,
        sessionToken: data.sessionToken,
        customerAccountId: data.customerAccountId,
        activeBusinessId: data.activeBusinessId,
        activeCustomerId: data.activeCustomerId,
        businesses: data.businesses,
      };
    } catch (err: any) {
      const message = err.message || 'Invalid email or password';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPassword = useCallback(async (password: string): Promise<AuthResult> => {
    setIsLoading(true);
    setError(null);

    const sessionToken = getPortalSessionToken();
    if (!sessionToken) {
      setError('Not authenticated');
      setIsLoading(false);
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'create-password', sessionToken, password },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      return { success: true };
    } catch (err: any) {
      const message = err.message || 'Failed to set password';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    const sessionToken = getPortalSessionToken();
    
    if (sessionToken) {
      try {
        await supabase.functions.invoke('portal-auth', {
          body: { action: 'logout', sessionToken },
        });
      } catch (err) {
        console.error('Logout error:', err);
      }
    }

    // Always clear local state
    clearPortalLocalState();
  }, []);

  const switchContext = useCallback(async (
    businessId: string,
    customerId: string
  ): Promise<AuthResult> => {
    const sessionToken = getPortalSessionToken();
    if (!sessionToken) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('portal-auth', {
        body: { action: 'switch-context', sessionToken, businessId, customerId },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Update local state
      setPortalActiveBusiness(businessId);
      setPortalActiveCustomer(customerId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to switch business' };
    }
  }, []);

  return {
    isLoading,
    error,
    generateMagicLink,
    validateMagicLink,
    loginWithPassword,
    createPassword,
    logout,
    switchContext,
  };
}
