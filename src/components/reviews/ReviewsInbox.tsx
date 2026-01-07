import { useState } from 'react';
import { format } from 'date-fns';
import { useReviews } from '@/hooks/useReviews';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Star, MessageSquare, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { ReviewDetailModal } from './ReviewDetailModal';
import type { Review } from '@/hooks/useReviews';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewsInbox() {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [responseFilter, setResponseFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { reviews, isLoading, isError } = useReviews({
    rating: ratingFilter !== 'all' ? parseInt(ratingFilter) : undefined,
    hasResponse: responseFilter === 'responded' ? true : responseFilter === 'pending' ? false : undefined,
  });

  const paginatedReviews = reviews.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(reviews.length / pageSize);

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">Failed to load reviews</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Reviews</CardTitle>
              <CardDescription>
                View and respond to customer feedback
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ratings</SelectItem>
                  <SelectItem value="5">5 stars</SelectItem>
                  <SelectItem value="4">4 stars</SelectItem>
                  <SelectItem value="3">3 stars</SelectItem>
                  <SelectItem value="2">2 stars</SelectItem>
                  <SelectItem value="1">1 star</SelectItem>
                </SelectContent>
              </Select>
              <Select value={responseFilter} onValueChange={setResponseFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Response status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reviews</SelectItem>
                  <SelectItem value="pending">Needs response</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : paginatedReviews.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Reviews from customers will appear here once they submit feedback."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Technician</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReviews.map((review) => (
                    <TableRow
                      key={review.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedReview(review)}
                    >
                      <TableCell className="text-muted-foreground">
                        {format(new Date(review.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {review.customer?.first_name} {review.customer?.last_name}
                      </TableCell>
                      <TableCell>
                        <StarRating rating={review.rating} />
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {review.feedback_text || (
                          <span className="text-muted-foreground italic">No comment</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {review.technician ? (
                          `${review.technician.first_name} ${review.technician.last_name}`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {review.response_text ? (
                          <Badge variant="secondary" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Responded
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReview(review);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to{' '}
                    {Math.min(page * pageSize, reviews.length)} of {reviews.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ReviewDetailModal
        review={selectedReview}
        open={!!selectedReview}
        onOpenChange={(open) => !open && setSelectedReview(null)}
      />
    </>
  );
}
