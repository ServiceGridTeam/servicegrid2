/**
 * Public Gallery Page
 * Route: /gallery/:token
 * Public-facing gallery for customers to view shared photos
 */

import { useParams } from 'react-router-dom';
import { usePublicGallery } from '@/hooks/usePublicGallery';
import { PublicGalleryViewer, GalleryEmailGate } from '@/components/gallery';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ImageOff, Clock, Ban, AlertCircle } from 'lucide-react';

export default function PublicGalleryPage() {
  const { token } = useParams<{ token: string }>();
  const {
    gallery,
    requiresEmail,
    businessName,
    apiError,
    isLoading,
    submitEmail,
    email,
  } = usePublicGallery(token);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="bg-background border-b">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24 mt-1" />
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Email gate
  if (requiresEmail && businessName && !email) {
    return (
      <GalleryEmailGate
        businessName={businessName}
        onSubmit={submitEmail}
        isLoading={isLoading}
      />
    );
  }

  // Error states
  if (apiError) {
    return <ErrorState code={apiError.code} message={apiError.message} />;
  }

  // Gallery loaded
  if (gallery) {
    return <PublicGalleryViewer gallery={gallery} />;
  }

  // Fallback - shouldn't reach here
  return <ErrorState code="NOT_FOUND" message="Gallery not found" />;
}

// Error state component
interface ErrorStateProps {
  code: string;
  message: string;
}

function ErrorState({ code, message }: ErrorStateProps) {
  const getIcon = () => {
    switch (code) {
      case 'EXPIRED':
        return <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />;
      case 'REVOKED':
        return <Ban className="h-16 w-16 mx-auto text-muted-foreground mb-4" />;
      case 'NOT_FOUND':
      case 'INVALID_TOKEN':
        return <ImageOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />;
      default:
        return <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />;
    }
  };

  const getTitle = () => {
    switch (code) {
      case 'EXPIRED':
        return 'Link Expired';
      case 'REVOKED':
        return 'Gallery Unavailable';
      case 'NOT_FOUND':
      case 'INVALID_TOKEN':
        return 'Gallery Not Found';
      case 'RATE_LIMITED':
        return 'Too Many Requests';
      default:
        return 'Something Went Wrong';
    }
  };

  const getDescription = () => {
    switch (code) {
      case 'EXPIRED':
        return 'This gallery link has expired. Please contact the business for a new link.';
      case 'REVOKED':
        return 'This gallery is no longer available. The link may have been revoked by the business.';
      case 'NOT_FOUND':
      case 'INVALID_TOKEN':
        return 'This gallery could not be found. The link may be incorrect or the gallery may have been removed.';
      case 'RATE_LIMITED':
        return 'You\'ve made too many requests. Please wait a moment and try again.';
      default:
        return message || 'An unexpected error occurred. Please try again later.';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-10">
          {getIcon()}
          <h1 className="text-xl font-semibold mb-2">{getTitle()}</h1>
          <p className="text-muted-foreground">{getDescription()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
