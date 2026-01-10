/**
 * Public Comparison Page - View shared before/after comparisons
 * Route: /compare/:token
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BeforeAfterComparison } from '@/components/comparisons';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ImageOff, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ComparisonDisplayMode } from '@/types/annotations';

export default function PublicComparison() {
  const { token } = useParams<{ token: string }>();

  const { data: comparison, isLoading, error } = useQuery({
    queryKey: ['public-comparison', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');

      const { data, error } = await supabase
        .from('before_after_comparisons')
        .select(`
          *,
          before_media:job_media!before_after_comparisons_before_media_id_fkey(
            id, url, thumbnail_url_lg
          ),
          after_media:job_media!before_after_comparisons_after_media_id_fkey(
            id, url, thumbnail_url_lg
          ),
          business:businesses(name, logo_url)
        `)
        .eq('share_token', token)
        .eq('is_public', true)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Comparison not found');

      // Check expiration
      if (data.share_expires_at && new Date(data.share_expires_at) < new Date()) {
        throw new Error('This link has expired');
      }

      return data;
    },
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="aspect-video w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !comparison) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
            <ImageOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold mb-2">Comparison Not Found</h1>
            <p className="text-muted-foreground">
              {error instanceof Error && error.message === 'This link has expired'
                ? 'This share link has expired.'
                : 'This comparison may have been removed or the link is invalid.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const beforeUrl = comparison.before_media?.url || comparison.before_media?.thumbnail_url_lg;
  const afterUrl = comparison.after_media?.url || comparison.after_media?.thumbnail_url_lg;

  if (!beforeUrl || !afterUrl) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
            <ImageOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold mb-2">Images Unavailable</h1>
            <p className="text-muted-foreground">
              The images for this comparison are no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {comparison.business?.logo_url ? (
              <img 
                src={comparison.business.logo_url} 
                alt="" 
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                {comparison.business?.name?.[0] || 'S'}
              </div>
            )}
            <span className="font-medium">
              {comparison.business?.name || 'ServiceGrid'}
            </span>
          </div>
          <Badge variant="secondary">
            <Calendar className="h-3 w-3 mr-1" />
            {format(new Date(comparison.created_at), 'MMM d, yyyy')}
          </Badge>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>
              {comparison.title || 'Before & After Comparison'}
            </CardTitle>
            {comparison.description && (
              <CardDescription>{comparison.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <BeforeAfterComparison
              beforeUrl={beforeUrl}
              afterUrl={afterUrl}
              displayMode={(comparison.display_mode as ComparisonDisplayMode) || 'slider'}
              showModeToggle={true}
            />
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Powered by ServiceGrid
        </div>
      </footer>
    </div>
  );
}
