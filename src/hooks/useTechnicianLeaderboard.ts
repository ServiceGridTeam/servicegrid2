import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';

export interface TechnicianStats {
  id: string;
  business_id: string;
  profile_id: string;
  total_reviews: number;
  average_rating: number | null;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  mentions_count: number;
  last_review_at: string | null;
  trend_7d: number | null;
  rank_in_business: number | null;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useTechnicianLeaderboard() {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ['technician-leaderboard', businessId],
    queryFn: async (): Promise<TechnicianStats[]> => {
      if (!businessId) return [];

      const { data, error } = await supabase
        .from('technician_review_stats')
        .select(`
          *,
          profile:profiles(first_name, last_name, avatar_url)
        `)
        .eq('business_id', businessId)
        .order('rank_in_business', { ascending: true });

      if (error) {
        console.error('Failed to fetch technician leaderboard:', error);
        throw error;
      }

      return (data || []) as TechnicianStats[];
    },
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTechnicianStats(profileId: string | null) {
  const { activeBusinessId } = useBusinessContext();
  const businessId = activeBusinessId;

  return useQuery({
    queryKey: ['technician-stats', businessId, profileId],
    queryFn: async (): Promise<TechnicianStats | null> => {
      if (!businessId || !profileId) return null;

      const { data, error } = await supabase
        .from('technician_review_stats')
        .select(`
          *,
          profile:profiles(first_name, last_name, avatar_url)
        `)
        .eq('business_id', businessId)
        .eq('profile_id', profileId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch technician stats:', error);
        throw error;
      }

      return data as TechnicianStats | null;
    },
    enabled: !!businessId && !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}
