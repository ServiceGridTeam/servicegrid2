/**
 * Public Gallery Hook
 * Fetches gallery data from the public-gallery-api edge function
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GalleryPhoto {
  id: string;
  media_type: string;
  description: string | null;
  category: string;
  thumbnail_url_sm: string;
  thumbnail_url_md: string;
  thumbnail_url_lg: string;
  url: string;
  width: number | null;
  height: number | null;
  captured_at: string | null;
}

export interface GalleryComparison {
  id: string;
  title: string | null;
  display_mode: string;
  before_media: {
    id: string;
    thumbnail_url_md: string;
    url: string;
  };
  after_media: {
    id: string;
    thumbnail_url_md: string;
    url: string;
  };
}

export interface GalleryBranding {
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_color: string | null;
  text_color: string | null;
  heading_font: string | null;
  body_font: string | null;
  footer_text: string | null;
  show_powered_by: boolean;
  gallery_title_template: string | null;
}

export interface GalleryData {
  business: {
    name: string;
    logo_url: string | null;
    branding: GalleryBranding | null;
  };
  job: {
    number: string;
    title: string | null;
    date: string | null;
  } | null;
  photos: GalleryPhoto[];
  comparisons: GalleryComparison[];
  permissions: {
    allow_download: boolean;
    allow_comments: boolean;
  };
  message: string | null;
  title: string | null;
}

interface GalleryResponse {
  gallery: GalleryData;
}

interface EmailRequiredResponse {
  requires_email: true;
  business_name: string;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse = GalleryResponse | EmailRequiredResponse | ErrorResponse;

export function usePublicGallery(token: string | undefined) {
  const [email, setEmail] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const fetchGallery = useCallback(async (): Promise<{
    gallery: GalleryData | null;
    requiresEmail: boolean;
    businessName: string | null;
    error: { code: string; message: string } | null;
  }> => {
    if (!token) {
      return { gallery: null, requiresEmail: false, businessName: null, error: null };
    }

    // Get Supabase URL for edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    // Build URL with optional email query param
    let url = `${supabaseUrl}/functions/v1/public-gallery-api/${token}`;
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (fingerprint) params.set('fingerprint', fingerprint);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as ApiResponse;

    // Handle email required response
    if ('requires_email' in data && data.requires_email) {
      return {
        gallery: null,
        requiresEmail: true,
        businessName: data.business_name,
        error: null,
      };
    }

    // Handle error response
    if ('error' in data) {
      return {
        gallery: null,
        requiresEmail: false,
        businessName: null,
        error: data.error,
      };
    }

    // Success
    return {
      gallery: data.gallery,
      requiresEmail: false,
      businessName: null,
      error: null,
    };
  }, [token, email, fingerprint]);

  const query = useQuery({
    queryKey: ['public-gallery', token, email],
    queryFn: fetchGallery,
    enabled: !!token,
    retry: (failureCount, error) => {
      // Don't retry for 4xx errors
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const submitEmail = useCallback((newEmail: string) => {
    setEmail(newEmail);
  }, []);

  const setVisitorFingerprint = useCallback((fp: string) => {
    setFingerprint(fp);
  }, []);

  return {
    ...query,
    gallery: query.data?.gallery || null,
    requiresEmail: query.data?.requiresEmail || false,
    businessName: query.data?.businessName || null,
    apiError: query.data?.error || null,
    submitEmail,
    setVisitorFingerprint,
    email,
  };
}

/**
 * Hook for posting comments to a gallery
 */
export function useGalleryComments(token: string | undefined) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postComment = useCallback(async (data: {
    mediaId: string;
    commentText: string;
    authorName: string;
    authorEmail?: string;
    isQuestion?: boolean;
    parentCommentId?: string;
  }) => {
    if (!token) {
      setError('No gallery token');
      return null;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/public-gallery-api/${token}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_id: data.mediaId,
            comment_text: data.commentText,
            author_name: data.authorName,
            author_email: data.authorEmail,
            is_question: data.isQuestion ?? false,
            parent_comment_id: data.parentCommentId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to post comment');
      }

      return result.comment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [token]);

  const fetchComments = useCallback(async (mediaId: string) => {
    if (!token) return [];

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(
      `${supabaseUrl}/functions/v1/public-gallery-api/${token}/comments/${mediaId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) return [];
    const result = await response.json();
    return result.comments || [];
  }, [token]);

  return {
    postComment,
    fetchComments,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
