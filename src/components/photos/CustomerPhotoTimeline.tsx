import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Calendar, Image as ImageIcon, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoLightbox } from '@/components/jobs/PhotoLightbox';
import type { JobMedia } from '@/hooks/useJobMedia';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface CustomerPhotoTimelineProps {
  customerId: string;
}

interface JobWithMedia {
  id: string;
  job_number: string;
  title: string | null;
  scheduled_start: string | null;
  status: string;
  media: JobMedia[];
}

export function CustomerPhotoTimeline({ customerId }: CustomerPhotoTimelineProps) {
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [lightboxMedia, setLightboxMedia] = useState<JobMedia[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Fetch all photos for this customer grouped by job
  const { data, isLoading } = useQuery({
    queryKey: ['customer-photos', customerId],
    queryFn: async () => {
      const { data: media, error } = await supabase
        .from('job_media')
        .select(`
          *,
          job:jobs!inner(
            id,
            job_number,
            title,
            scheduled_start,
            status
          )
        `)
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .eq('status', 'ready')
        .order('captured_at', { ascending: false });

      if (error) throw error;
      return media as (JobMedia & { job: JobWithMedia['media'][0] extends never ? never : { id: string; job_number: string; title: string | null; scheduled_start: string | null; status: string } })[];
    },
    enabled: !!customerId,
  });

  // Group media by job
  const jobsWithMedia = useMemo(() => {
    if (!data) return [];

    const jobMap = new Map<string, JobWithMedia>();

    data.forEach((item) => {
      const jobId = item.job_id;
      if (!jobMap.has(jobId)) {
        jobMap.set(jobId, {
          id: jobId,
          job_number: item.job.job_number,
          title: item.job.title,
          scheduled_start: item.job.scheduled_start,
          status: item.job.status,
          media: [],
        });
      }
      const { job, ...mediaOnly } = item;
      jobMap.get(jobId)!.media.push(mediaOnly as JobMedia);
    });

    // Sort by most recent scheduled_start
    return Array.from(jobMap.values()).sort((a, b) => {
      const dateA = a.scheduled_start ? new Date(a.scheduled_start).getTime() : 0;
      const dateB = b.scheduled_start ? new Date(b.scheduled_start).getTime() : 0;
      return dateB - dateA;
    });
  }, [data]);

  const totalPhotos = data?.length ?? 0;

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const openLightbox = (media: JobMedia[], index: number) => {
    setLightboxMedia(media);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <div className="grid grid-cols-4 gap-2 pl-6">
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (totalPhotos === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Camera className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <h3 className="font-semibold text-lg mb-1">No photos yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Photos taken during jobs for this customer will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">
          Customer Photos
        </h3>
        <Badge variant="secondary">{totalPhotos}</Badge>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {jobsWithMedia.map((job) => {
          const isExpanded = expandedJobs.has(job.id);

          return (
            <div
              key={job.id}
              className="border rounded-lg overflow-hidden"
            >
              {/* Job header */}
              <button
                type="button"
                onClick={() => toggleJob(job.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {job.job_number}
                    </span>
                    {job.title && (
                      <span className="text-muted-foreground truncate">
                        — {job.title}
                      </span>
                    )}
                  </div>
                  {job.scheduled_start && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(job.scheduled_start), 'MMM d, yyyy')}
                    </div>
                  )}
                </div>

                <Badge variant="outline" className="flex-shrink-0">
                  {job.media.length} photos
                </Badge>
              </button>

              {/* Photo grid */}
              {isExpanded && (
                <div className="p-3 pt-0 border-t bg-muted/30">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-3">
                    {job.media.map((media, index) => (
                      <button
                        key={media.id}
                        type="button"
                        onClick={() => openLightbox(job.media, index)}
                        className="aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
                      >
                        <img
                          src={media.thumbnail_url_sm || media.url}
                          alt={media.description || 'Photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        media={lightboxMedia}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}