/**
 * Portal Gallery Section
 * Displays active gallery share for a job, allowing customers to access their photo gallery
 */

import { motion } from 'framer-motion';
import { ExternalLink, Image, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortalGalleryAccess } from '@/hooks/usePortalGalleryAccess';

interface PortalGallerySectionProps {
  jobId: string;
  photoCount?: number;
}

export function PortalGallerySection({ jobId, photoCount = 0 }: PortalGallerySectionProps) {
  const { data: gallery, isLoading } = usePortalGalleryAccess({ jobId });

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show section if no active gallery
  if (!gallery) {
    return null;
  }

  const galleryUrl = `/gallery/${gallery.share_token}`;
  const businessLogo = gallery.branding?.logo_url || gallery.business?.logo_url;
  const businessName = gallery.business?.name || 'Business';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Business Logo or Icon */}
            <div 
              className="flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ 
                backgroundColor: gallery.branding?.primary_color 
                  ? `${gallery.branding.primary_color}20` 
                  : 'hsl(var(--primary) / 0.1)' 
              }}
            >
              {businessLogo ? (
                <img 
                  src={businessLogo} 
                  alt={businessName}
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <Image 
                  className="h-6 w-6" 
                  style={{ 
                    color: gallery.branding?.primary_color || 'hsl(var(--primary))' 
                  }}
                />
              )}
            </div>

            {/* Gallery Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">
                {gallery.custom_title || 'Photo Gallery'}
              </h4>
              <p className="text-xs text-muted-foreground">
                {photoCount > 0 
                  ? `View all ${photoCount} photo${photoCount !== 1 ? 's' : ''} from your job`
                  : 'View photos from your job'
                }
              </p>
              {gallery.view_count > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  <span>Viewed {gallery.view_count} time{gallery.view_count !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* View Button */}
            <Button 
              size="sm" 
              className="flex-shrink-0 gap-2"
              onClick={() => window.open(galleryUrl, '_blank')}
              style={gallery.branding?.primary_color ? {
                backgroundColor: gallery.branding.primary_color,
              } : undefined}
            >
              <span>View Gallery</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Custom Message */}
          {gallery.custom_message && (
            <p className="mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground">
              {gallery.custom_message}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
