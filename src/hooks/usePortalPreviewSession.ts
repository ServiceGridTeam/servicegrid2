import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { StoredPortalBusiness } from '@/lib/portalLocalState';

interface PreviewSessionData {
  isAuthenticated: boolean;
  isLoading: boolean;
  activeBusinessId: string | null;
  activeCustomerId: string | null;
  customerAccountId: string | null;
  businesses: StoredPortalBusiness[];
  email: string | null;
  customerName: string | null;
}

export function usePortalPreviewSession(): PreviewSessionData {
  const [searchParams] = useSearchParams();
  
  const customerId = searchParams.get('customerId');
  const businessId = searchParams.get('businessId');

  const { data, isLoading } = useQuery({
    queryKey: ['portal-preview-session', customerId, businessId],
    queryFn: async () => {
      if (!customerId || !businessId) {
        throw new Error('Missing customerId or businessId');
      }

      // Fetch customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, business_id')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      // Fetch business details
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, logo_url')
        .eq('id', businessId)
        .single();

      if (businessError) throw businessError;

      return {
        customer,
        business,
      };
    },
    enabled: !!customerId && !!businessId,
  });

  if (!customerId || !businessId) {
    return {
      isAuthenticated: false,
      isLoading: false,
      activeBusinessId: null,
      activeCustomerId: null,
      customerAccountId: null,
      businesses: [],
      email: null,
      customerName: null,
    };
  }

  const businesses: StoredPortalBusiness[] = data?.business
    ? [
        {
          businessId: data.business.id,
          businessName: data.business.name,
          customerId: data.customer?.id || '',
          logoUrl: data.business.logo_url,
          primaryColor: null,
          isPrimary: true,
        },
      ]
    : [];

  return {
    isAuthenticated: true, // Always true in preview mode
    isLoading,
    activeBusinessId: businessId,
    activeCustomerId: customerId,
    customerAccountId: null, // Not needed for preview
    businesses,
    email: data?.customer?.email || null,
    customerName: data?.customer
      ? `${data.customer.first_name} ${data.customer.last_name}`
      : null,
  };
}

export default usePortalPreviewSession;
