/**
 * Hook for fetching gallery analytics data
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { subDays, format, startOfDay, eachDayOfInterval } from 'date-fns';

export interface GalleryAnalyticsSummary {
  totalActiveShares: number;
  totalViews: number;
  totalDownloads: number;
  uniqueViewers: number;
  avgViewsPerShare: number;
}

export interface ViewTrendData {
  date: string;
  views: number;
  downloads: number;
}

export interface TopGallery {
  id: string;
  title: string;
  jobId: string;
  views: number;
  downloads: number;
  createdAt: string;
}

export interface DeviceBreakdown {
  device: string;
  count: number;
  percentage: number;
}

export interface GalleryAnalyticsData {
  summary: GalleryAnalyticsSummary;
  viewTrends: ViewTrendData[];
  topGalleries: TopGallery[];
  deviceBreakdown: DeviceBreakdown[];
}

export function useGalleryAnalytics(dateRange: { start: Date; end: Date }) {
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['gallery-analytics', activeBusinessId, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async (): Promise<GalleryAnalyticsData> => {
      if (!activeBusinessId) throw new Error('No active business');

      const startDate = startOfDay(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end.setHours(23, 59, 59, 999)).toISOString();

      // Fetch active shares count
      const { count: activeSharesCount } = await supabase
        .from('photo_gallery_shares')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', activeBusinessId)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      // Fetch views in date range
      const { data: viewsData } = await supabase
        .from('gallery_views')
        .select('*')
        .eq('business_id', activeBusinessId)
        .gte('viewed_at', startDate)
        .lte('viewed_at', endDate);

      const views = viewsData || [];

      // Calculate summary
      const totalViews = views.length;
      const totalDownloads = views.reduce((sum, v) => {
        const downloadedPhotos = v.downloaded_photos as string[] | null;
        return sum + (downloadedPhotos?.length || 0);
      }, 0);
      const uniqueVisitors = new Set(views.map(v => v.visitor_ip_hash)).size;
      const avgViewsPerShare = activeSharesCount ? Math.round(totalViews / activeSharesCount) : 0;

      // Build view trends by day
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
      const viewTrends: ViewTrendData[] = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayViews = views.filter(v => {
          const viewDate = format(new Date(v.viewed_at), 'yyyy-MM-dd');
          return viewDate === dayStr;
        });
        
        const dayDownloads = dayViews.reduce((sum, v) => {
          const downloadedPhotos = v.downloaded_photos as string[] | null;
          return sum + (downloadedPhotos?.length || 0);
        }, 0);

        return {
          date: format(day, 'MMM d'),
          views: dayViews.length,
          downloads: dayDownloads,
        };
      });

      // Fetch top galleries
      const { data: topGalleriesData } = await supabase
        .from('photo_gallery_shares')
        .select(`
          id,
          custom_title,
          job_id,
          view_count,
          download_count,
          created_at
        `)
        .eq('business_id', activeBusinessId)
        .order('view_count', { ascending: false })
        .limit(10);

      const topGalleries: TopGallery[] = (topGalleriesData || []).map(g => ({
        id: g.id,
        title: g.custom_title || 'Untitled Gallery',
        jobId: g.job_id,
        views: g.view_count || 0,
        downloads: g.download_count || 0,
        createdAt: g.created_at,
      }));

      // Calculate device breakdown
      const deviceCounts: Record<string, number> = {};
      views.forEach(v => {
        const device = v.device_type || 'unknown';
        deviceCounts[device] = (deviceCounts[device] || 0) + 1;
      });

      const totalDeviceViews = Object.values(deviceCounts).reduce((a, b) => a + b, 0);
      const deviceBreakdown: DeviceBreakdown[] = Object.entries(deviceCounts)
        .map(([device, count]) => ({
          device: device.charAt(0).toUpperCase() + device.slice(1),
          count,
          percentage: totalDeviceViews ? Math.round((count / totalDeviceViews) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      return {
        summary: {
          totalActiveShares: activeSharesCount || 0,
          totalViews,
          totalDownloads,
          uniqueViewers: uniqueVisitors,
          avgViewsPerShare,
        },
        viewTrends,
        topGalleries,
        deviceBreakdown,
      };
    },
    enabled: !!activeBusinessId,
    staleTime: 30000, // 30 seconds
  });
}

// Quick stats for last 30 days (used on Photos page)
export function useGalleryQuickStats() {
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  
  return useGalleryAnalytics({ start: startDate, end: endDate });
}
