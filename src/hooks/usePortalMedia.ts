/**
 * Hook for fetching privacy-safe media URLs for the customer portal
 * Strips sensitive EXIF data (GPS coordinates) from photos
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StrippedMediaUrl {
  mediaId: string;
  url: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UsePortalMediaOptions {
  mediaIds: string[];
  context?: 'portal' | 'public';
}

interface UsePortalMediaResult {
  urls: Map<string, string | null>;
  isLoading: boolean;
  error: string | null;
  getStrippedUrl: (mediaId: string) => Promise<string | null>;
}

/**
 * Get privacy-safe media URLs for portal display
 * Automatically strips GPS and sensitive EXIF data
 */
export function usePortalMedia({
  mediaIds,
  context = 'portal',
}: UsePortalMediaOptions): UsePortalMediaResult {
  const [urls, setUrls] = useState<Map<string, string | null>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStrippedUrl = useCallback(async (mediaId: string): Promise<string | null> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('strip-exif-for-portal', {
        body: { media_id: mediaId, context },
      });

      if (fnError) {
        console.error('Failed to get stripped URL:', fnError);
        return null;
      }

      if (data?.success && data?.url) {
        return data.url;
      }

      return null;
    } catch (err) {
      console.error('Error stripping EXIF:', err);
      return null;
    }
  }, [context]);

  useEffect(() => {
    if (mediaIds.length === 0) {
      setUrls(new Map());
      return;
    }

    let cancelled = false;

    async function fetchStrippedUrls() {
      setIsLoading(true);
      setError(null);

      try {
        const newUrls = new Map<string, string | null>();

        // Fetch in parallel but with a limit to avoid overwhelming the server
        const batchSize = 5;
        for (let i = 0; i < mediaIds.length; i += batchSize) {
          if (cancelled) break;

          const batch = mediaIds.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map(async (id) => {
              const url = await getStrippedUrl(id);
              return { id, url };
            })
          );

          results.forEach(({ id, url }) => {
            newUrls.set(id, url);
          });
        }

        if (!cancelled) {
          setUrls(newUrls);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch media URLs');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchStrippedUrls();

    return () => {
      cancelled = true;
    };
  }, [mediaIds, getStrippedUrl]);

  return {
    urls,
    isLoading,
    error,
    getStrippedUrl,
  };
}

/**
 * Get a single stripped media URL on-demand
 */
export async function getStrippedMediaUrl(
  mediaId: string,
  context: 'portal' | 'public' = 'portal'
): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('strip-exif-for-portal', {
      body: { media_id: mediaId, context },
    });

    if (error) {
      console.error('Failed to get stripped URL:', error);
      return null;
    }

    return data?.success ? data.url : null;
  } catch (err) {
    console.error('Error getting stripped URL:', err);
    return null;
  }
}
