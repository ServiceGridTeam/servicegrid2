import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, X, Camera, Grid3X3, List, MapPin, Calendar, Tag, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { useSearchPhotos, usePhotoFacets, SearchPhotosParams } from '@/hooks/useSearchPhotos';
import { useTags } from '@/hooks/useTags';
import { useCustomers } from '@/hooks/useCustomers';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { TagChip } from '@/components/tags';
import { EmptyState } from '@/components/ui/empty-state';

const CATEGORIES = [
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'issue', label: 'Issue' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
];

export default function Photos() {
  const navigate = useNavigate();
  
  // Search state
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [hasGpsFilter, setHasGpsFilter] = useState<boolean | undefined>();
  
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Build search params
  const searchParams = useMemo<SearchPhotosParams>(() => ({
    query: debouncedQuery || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    customerId: selectedCustomerId,
    dateFrom,
    dateTo,
    hasGps: hasGpsFilter,
  }), [debouncedQuery, selectedTags, selectedCategories, selectedCustomerId, dateFrom, dateTo, hasGpsFilter]);

  // Data hooks
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useSearchPhotos(searchParams);
  const { data: facets } = usePhotoFacets(debouncedQuery);
  const { data: tags } = useTags();
  const { data: customers } = useCustomers();

  // Flatten results from all pages
  const photos = useMemo(() => {
    return data?.pages.flatMap(page => page.results) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount || 0;

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTags.length > 0) count++;
    if (selectedCategories.length > 0) count++;
    if (selectedCustomerId) count++;
    if (dateFrom || dateTo) count++;
    if (hasGpsFilter !== undefined) count++;
    return count;
  }, [selectedTags, selectedCategories, selectedCustomerId, dateFrom, dateTo, hasGpsFilter]);

  const clearFilters = useCallback(() => {
    setSelectedTags([]);
    setSelectedCategories([]);
    setSelectedCustomerId(undefined);
    setDateFrom(undefined);
    setDateTo(undefined);
    setHasGpsFilter(undefined);
  }, []);

  const toggleTag = useCallback((slug: string) => {
    setSelectedTags(prev => 
      prev.includes(slug) ? prev.filter(t => t !== slug) : [...prev, slug]
    );
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
            <p className="text-sm text-muted-foreground">
              Search and browse all job photos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search photos by job, customer, description, or tags..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearchInput('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant={filtersOpen ? 'secondary' : 'outline'}
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filters panel */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Categories */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Categories</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const facetCount = facets?.categories.find(c => c.value === cat.value)?.count;
                    return (
                      <Badge
                        key={cat.value}
                        variant={selectedCategories.includes(cat.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(cat.value)}
                      >
                        {cat.label}
                        {facetCount !== undefined && (
                          <span className="ml-1 opacity-60">({facetCount})</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {tags?.slice(0, 10).map((tag) => (
                    <TagChip
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      selected={selectedTags.includes(tag.slug)}
                      onClick={() => toggleTag(tag.slug)}
                      size="sm"
                    />
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Customer</Label>
                <Select value={selectedCustomerId || ''} onValueChange={(v) => setSelectedCustomerId(v || undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All customers</SelectItem>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* GPS Filter */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Location</Label>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gps-yes"
                      checked={hasGpsFilter === true}
                      onCheckedChange={(checked) => setHasGpsFilter(checked ? true : undefined)}
                    />
                    <Label htmlFor="gps-yes" className="text-sm">
                      <MapPin className="inline h-3 w-3 mr-1" />
                      With GPS ({facets?.gpsStats.withGps || 0})
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gps-no"
                      checked={hasGpsFilter === false}
                      onCheckedChange={(checked) => setHasGpsFilter(checked ? false : undefined)}
                    />
                    <Label htmlFor="gps-no" className="text-sm">
                      No GPS ({facets?.gpsStats.withoutGps || 0})
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-3 w-3 mr-1" />
                Clear all filters
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Results count */}
          {!isLoading && (
            <p className="text-sm text-muted-foreground mb-4">
              {totalCount === 0 ? 'No photos found' : `${totalCount} photo${totalCount === 1 ? '' : 's'} found`}
            </p>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-2'}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={viewMode === 'grid' ? 'aspect-square rounded-lg' : 'h-16 rounded-lg'} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && photos.length === 0 && (
            <EmptyState
              icon={Camera}
              title="No photos found"
              description={searchInput || activeFilterCount > 0 
                ? "Try adjusting your search or filters"
                : "Photos from jobs will appear here"
              }
            />
          )}

          {/* Grid view */}
          {!isLoading && photos.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {photos.map((photo) => (
                <Card
                  key={photo.media_id}
                  className="group overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => photo.job_id && navigate(`/jobs?job=${photo.job_id}`)}
                >
                  <div className="aspect-square relative bg-muted">
                    {photo.thumbnail_url ? (
                      <img
                        src={photo.thumbnail_url}
                        alt={photo.category || 'Photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-xs text-white font-medium truncate">{photo.job_title || 'Untitled Job'}</p>
                      <p className="text-xs text-white/70 truncate">{photo.customer_name}</p>
                      {photo.captured_date && (
                        <p className="text-xs text-white/50">{format(new Date(photo.captured_date), 'MMM d, yyyy')}</p>
                      )}
                    </div>

                    {/* Category badge */}
                    {photo.category && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-1.5 left-1.5 text-[10px] capitalize bg-background/80"
                      >
                        {photo.category}
                      </Badge>
                    )}

                    {/* GPS indicator */}
                    {photo.has_gps && (
                      <div className="absolute top-1.5 right-1.5 bg-background/80 rounded-full p-1">
                        <MapPin className="h-3 w-3 text-primary" />
                      </div>
                    )}

                    {/* Tags */}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-0.5 group-hover:hidden">
                        {photo.tags.slice(0, 2).map((tagSlug) => {
                          const tag = tags?.find(t => t.slug === tagSlug);
                          return tag ? (
                            <TagChip key={tagSlug} name={tag.name} color={tag.color} size="sm" />
                          ) : null;
                        })}
                        {photo.tags.length > 2 && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            +{photo.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* List view */}
          {!isLoading && photos.length > 0 && viewMode === 'list' && (
            <div className="space-y-2">
              {photos.map((photo) => (
                <Card
                  key={photo.media_id}
                  className="group cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  onClick={() => photo.job_id && navigate(`/jobs?job=${photo.job_id}`)}
                >
                  <CardContent className="p-3 flex gap-3">
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {photo.thumbnail_url ? (
                        <img
                          src={photo.thumbnail_url}
                          alt={photo.category || 'Photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium truncate">{photo.job_title || 'Untitled Job'}</p>
                          <p className="text-sm text-muted-foreground truncate">{photo.customer_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {photo.category && (
                            <Badge variant="outline" className="capitalize text-xs">
                              {photo.category}
                            </Badge>
                          )}
                          {photo.has_gps && (
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {photo.captured_date && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(photo.captured_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        {photo.job_number && (
                          <span className="text-xs text-muted-foreground">
                            #{photo.job_number}
                          </span>
                        )}
                      </div>
                      {photo.tags && photo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {photo.tags.slice(0, 5).map((tagSlug) => {
                            const tag = tags?.find(t => t.slug === tagSlug);
                            return tag ? (
                              <TagChip key={tagSlug} name={tag.name} color={tag.color} size="sm" />
                            ) : null;
                          })}
                          {photo.tags.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{photo.tags.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Loading...' : 'Load more photos'}
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
