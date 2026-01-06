/**
 * Hook to fetch user's business memberships
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import * as localState from '@/lib/localState';
import type { AppRole } from '@/lib/permissions';

export interface BusinessMembership {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  businessLogo: string | null;
  role: AppRole;
  status: 'active' | 'suspended' | 'left' | 'removed';
  isPrimary: boolean;
  joinedAt: string;
}

interface RawMembership {
  id: string;
  user_id: string;
  business_id: string;
  role: string;
  status: string;
  is_primary: boolean;
  joined_at: string;
  businesses: {
    name: string;
    logo_url: string | null;
  } | null;
}

export function useBusinessMemberships() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['business-memberships', user?.id],
    queryFn: async (): Promise<BusinessMembership[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('business_memberships')
        .select(`
          id,
          user_id,
          business_id,
          role,
          status,
          is_primary,
          joined_at,
          businesses (
            name,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('is_primary', { ascending: false })
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error fetching memberships:', error);
        throw error;
      }

      const memberships: BusinessMembership[] = (data as RawMembership[] || []).map((m) => ({
        id: m.id,
        userId: m.user_id,
        businessId: m.business_id,
        businessName: m.businesses?.name || 'Unknown Business',
        businessLogo: m.businesses?.logo_url || null,
        role: m.role as AppRole,
        status: m.status as BusinessMembership['status'],
        isPrimary: m.is_primary,
        joinedAt: m.joined_at,
      }));

      // Update localStorage cache
      localState.setMemberships(
        memberships.map((m) => ({
          id: m.id,
          businessId: m.businessId,
          businessName: m.businessName,
          role: m.role,
          isPrimary: m.isPrimary,
        }))
      );

      return memberships;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use localStorage as placeholder while loading
    placeholderData: () => {
      const cached = localState.getMemberships();
      if (cached.length === 0) return undefined;
      return cached.map((m) => ({
        id: m.id,
        userId: user?.id || '',
        businessId: m.businessId,
        businessName: m.businessName,
        businessLogo: null,
        role: m.role,
        status: 'active' as const,
        isPrimary: m.isPrimary,
        joinedAt: '',
      }));
    },
  });
}
