import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from './useBusinessContext';

export interface SearchPhotosParams {
  query?: string;
  tags?: string[];
  categories?: string[];
  customerId?: string;
  jobId?: string;
  dateFrom?: string;
  dateTo?: string;
  hasGps?: boolean;
}

export interface PhotoSearchResult {
  media_id: string;
  thumbnail_url: string | null;
  media_url: string | null;
  media_type: string;
  job_id: string | null;
  job_title: string | null;
  job_number: string | null;
  customer_id: string | null;
  customer_name: string;
  category: string | null;
  tags: string[];
  captured_date: string | null;
  has_gps: boolean;
  total_count: number;
}

export interface PhotoFacet {
  facet_type: 'category' | 'tag' | 'has_gps';
  facet_value: string;
  facet_count: number;
}

interface SearchPageResult {
  results: PhotoSearchResult[];
  totalCount: number;
  page: number;
}

const PAGE_SIZE = 50;

export function useSearchPhotos(params: SearchPhotosParams) {
  const { activeBusinessId } = useBusinessContext();

  return useInfiniteQuery<SearchPageResult, Error>({
    queryKey: ['photo-search', activeBusinessId, params],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      if (!activeBusinessId) return { results: [], totalCount: 0, page };

      const { data, error } = await supabase.rpc('search_photos', {
        p_business_id: activeBusinessId,
        p_query: params.query || null,
        p_tags: params.tags?.length ? params.tags : null,
        p_categories: params.categories?.length ? params.categories : null,
        p_customer_id: params.customerId || null,
        p_job_id: params.jobId || null,
        p_date_from: params.dateFrom || null,
        p_date_to: params.dateTo || null,
        p_has_gps: params.hasGps ?? null,
        p_page: page,
        p_per_page: PAGE_SIZE,
      });

      if (error) throw error;

      const results = (data as PhotoSearchResult[]) || [];
      const totalCount = results[0]?.total_count || 0;

      return {
        results,
        totalCount,
        page,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((acc, page) => acc + page.results.length, 0);
      if (totalFetched < lastPage.totalCount) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!activeBusinessId,
    staleTime: 30000, // 30 seconds
  });
}

export function usePhotoFacets(query?: string) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['photo-facets', activeBusinessId, query],
    queryFn: async () => {
      if (!activeBusinessId) return { categories: [], tags: [], gpsStats: { withGps: 0, withoutGps: 0 } };

      const { data, error } = await supabase.rpc('get_photo_facets', {
        p_business_id: activeBusinessId,
        p_query: query || null,
      });

      if (error) throw error;

      const facets = (data as PhotoFacet[]) || [];

      const categories: { value: string; count: number }[] = [];
      const tags: { value: string; count: number }[] = [];
      let withGps = 0;
      let withoutGps = 0;

      facets.forEach((facet) => {
        if (facet.facet_type === 'category') {
          categories.push({ value: facet.facet_value, count: facet.facet_count });
        } else if (facet.facet_type === 'tag') {
          tags.push({ value: facet.facet_value, count: facet.facet_count });
        } else if (facet.facet_type === 'has_gps') {
          if (facet.facet_value === 'true') {
            withGps = facet.facet_count;
          } else {
            withoutGps = facet.facet_count;
          }
        }
      });

      return {
        categories: categories.sort((a, b) => b.count - a.count),
        tags: tags.sort((a, b) => b.count - a.count),
        gpsStats: { withGps, withoutGps },
      };
    },
    enabled: !!activeBusinessId,
    staleTime: 60000, // 1 minute
  });
}

export function useCustomerPhotoTimeline(customerId: string | null) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['customer-photos', customerId, activeBusinessId],
    queryFn: async () => {
      if (!customerId || !activeBusinessId) return { jobs: [], totalPhotos: 0 };

      const { data, error } = await supabase
        .from('job_media')
        .select(`
          *,
          job:jobs(id, title, job_number, scheduled_start, status)
        `)
        .eq('customer_id', customerId)
        .eq('business_id', activeBusinessId)
        .is('deleted_at', null)
        .eq('status', 'ready')
        .order('captured_at', { ascending: false });

      if (error) throw error;

      // Group photos by job
      const jobMap = new Map<string, {
        job: { id: string; title: string | null; job_number: string | null; scheduled_start: string | null; status: string | null };
        photos: typeof data;
      }>();

      (data || []).forEach((photo) => {
        const jobId = photo.job_id;
        if (!jobId) return;

        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, {
            job: photo.job as any,
            photos: [],
          });
        }
        jobMap.get(jobId)!.photos.push(photo);
      });

      // Sort jobs by most recent photo
      const jobs = Array.from(jobMap.values()).sort((a, b) => {
        const aDate = a.photos[0]?.captured_at || a.photos[0]?.created_at || '';
        const bDate = b.photos[0]?.captured_at || b.photos[0]?.created_at || '';
        return bDate.localeCompare(aDate);
      });

      return {
        jobs,
        totalPhotos: data?.length || 0,
      };
    },
    enabled: !!customerId && !!activeBusinessId,
  });
}

export function useRefreshSearchIndex() {
  return async () => {
    const { error } = await supabase.rpc('refresh_media_search_index');
    if (error) throw error;
  };
}
