/**
 * Public Gallery Viewer
 * Main gallery display component for public-facing galleries
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Camera, Layers, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { GalleryPhotoCard } from './GalleryPhotoCard';
import { GalleryLightbox } from './GalleryLightbox';
import { BeforeAfterComparison } from '@/components/comparisons';
import type { GalleryData, GalleryPhoto, GalleryComparison } from '@/hooks/usePublicGallery';
import { ComparisonDisplayMode } from '@/types/annotations';

interface PublicGalleryViewerProps {
  gallery: GalleryData;
  shareToken: string;
}

export function PublicGalleryViewer({ gallery, shareToken }: PublicGalleryViewerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(gallery.photos.map((p) => p.category));
    return Array.from(cats).sort();
  }, [gallery.photos]);

  // Filter photos by category
  const filteredPhotos = useMemo(() => {
    if (!activeCategory) return gallery.photos;
    return gallery.photos.filter((p) => p.category === activeCategory);
  }, [gallery.photos, activeCategory]);

  const hasComparisons = gallery.comparisons.length > 0;

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const branding = gallery.business.branding;

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: branding?.background_color || undefined,
        color: branding?.text_color || undefined,
      }}
    >
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {gallery.business.logo_url ? (
                <img
                  src={gallery.business.logo_url}
                  alt={gallery.business.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg"
                  style={{ 
                    backgroundColor: branding?.primary_color || 'hsl(var(--primary))',
                    color: 'white',
                  }}
                >
                  {gallery.business.name[0]?.toUpperCase() || 'G'}
                </div>
              )}
              <div>
                <h1 className="font-semibold">{gallery.business.name}</h1>
                {gallery.job && (
                  <p className="text-sm text-muted-foreground">
                    {gallery.job.title || gallery.job.number}
                  </p>
                )}
              </div>
            </div>
            {gallery.job?.date && (
              <Badge variant="secondary">
                <Calendar className="h-3 w-3 mr-1" />
                {format(new Date(gallery.job.date), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Title and message */}
        {(gallery.title || gallery.message) && (
          <div className="mb-8">
            {gallery.title && (
              <h2 className="text-2xl font-bold mb-2">{gallery.title}</h2>
            )}
            {gallery.message && (
              <p className="text-muted-foreground whitespace-pre-wrap">
                {gallery.message}
              </p>
            )}
          </div>
        )}

        {/* Tabs for Photos / Comparisons */}
        {hasComparisons ? (
          <Tabs defaultValue="photos">
            <TabsList className="mb-6">
              <TabsTrigger value="photos" className="gap-2">
                <Camera className="h-4 w-4" />
                Photos ({gallery.photos.length})
              </TabsTrigger>
              <TabsTrigger value="comparisons" className="gap-2">
                <Layers className="h-4 w-4" />
                Before & After ({gallery.comparisons.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos">
              <PhotosSection
                photos={filteredPhotos}
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                permissions={gallery.permissions}
                onPhotoClick={openLightbox}
              />
            </TabsContent>

            <TabsContent value="comparisons">
              <ComparisonsSection comparisons={gallery.comparisons} />
            </TabsContent>
          </Tabs>
        ) : (
          <PhotosSection
            photos={filteredPhotos}
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            permissions={gallery.permissions}
            onPhotoClick={openLightbox}
          />
        )}
      </main>

      {/* Footer */}
      {branding?.show_powered_by !== false && (
        <footer className="border-t bg-background mt-auto">
          <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
            {branding?.footer_text || 'Powered by ServiceGrid'}
          </div>
        </footer>
      )}

      {/* Lightbox */}
      <GalleryLightbox
        photos={filteredPhotos}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
        allowDownload={gallery.permissions.allow_download}
        allowComments={gallery.permissions.allow_comments}
        shareToken={shareToken}
      />
    </div>
  );
}

// Photos section component
interface PhotosSectionProps {
  photos: GalleryPhoto[];
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  permissions: { allow_download: boolean; allow_comments: boolean };
  onPhotoClick: (index: number) => void;
}

function PhotosSection({
  photos,
  categories,
  activeCategory,
  onCategoryChange,
  permissions,
  onPhotoClick,
}: PhotosSectionProps) {
  return (
    <div className="space-y-6">
      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange(null)}
          >
            All ({photos.length})
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(cat)}
              className="capitalize"
            >
              {cat.replace('_', ' ')}
            </Button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No photos in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {photos.map((photo, index) => (
            <GalleryPhotoCard
              key={photo.id}
              photo={photo}
              allowDownload={permissions.allow_download}
              allowComments={permissions.allow_comments}
              onClick={() => onPhotoClick(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Comparisons section component
interface ComparisonsSectionProps {
  comparisons: GalleryComparison[];
}

function ComparisonsSection({ comparisons }: ComparisonsSectionProps) {
  return (
    <div className="space-y-8">
      {comparisons.map((comparison) => (
        <Card key={comparison.id}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {comparison.title || 'Before & After'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BeforeAfterComparison
              beforeUrl={comparison.before_media.url}
              afterUrl={comparison.after_media.url}
              displayMode={(comparison.display_mode as ComparisonDisplayMode) || 'slider'}
              showModeToggle={true}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
