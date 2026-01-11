/**
 * Gallery Comments Moderation Panel
 * Staff-facing interface for managing gallery comments
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, MessageSquare, HelpCircle, Inbox } from 'lucide-react';
import { CommentModerationCard } from './CommentModerationCard';
import {
  useGalleryCommentsModeration,
  useMarkCommentRead,
  useResolveComment,
  useHideComment,
  useAddStaffReply,
  useDeleteStaffReply,
} from '@/hooks/useGalleryCommentsModeration';

interface GalleryCommentsModerationProps {
  jobId?: string;
  shareId?: string;
}

export function GalleryCommentsModeration({ jobId, shareId }: GalleryCommentsModerationProps) {
  const [activeTab, setActiveTab] = useState<'unread' | 'questions' | 'all'>('unread');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch comments based on active tab
  const { data: allComments, isLoading } = useGalleryCommentsModeration({
    jobId,
    shareId,
  });

  // Mutations
  const markRead = useMarkCommentRead();
  const resolve = useResolveComment();
  const hide = useHideComment();
  const addReply = useAddStaffReply();
  const deleteReply = useDeleteStaffReply();

  const isUpdating = 
    markRead.isPending || 
    resolve.isPending || 
    hide.isPending || 
    addReply.isPending || 
    deleteReply.isPending;

  // Filter comments
  const filteredComments = (allComments || []).filter(comment => {
    // Tab filter
    if (activeTab === 'unread' && comment.is_read) return false;
    if (activeTab === 'questions' && !comment.is_question) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        comment.author_name.toLowerCase().includes(query) ||
        comment.comment_text.toLowerCase().includes(query) ||
        comment.author_email?.toLowerCase().includes(query) ||
        comment.job_media?.job?.job_number?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Counts for badges
  const unreadCount = (allComments || []).filter(c => !c.is_read).length;
  const questionsCount = (allComments || []).filter(c => c.is_question && !c.is_resolved).length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search comments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="unread" className="gap-1">
            <Inbox className="h-4 w-4" />
            Unread
            {unreadCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-1">
            <HelpCircle className="h-4 w-4" />
            Questions
            {questionsCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 bg-amber-500/10 text-amber-600">
                {questionsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <MessageSquare className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredComments.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {activeTab === 'unread' && 'No unread comments'}
                {activeTab === 'questions' && 'No unanswered questions'}
                {activeTab === 'all' && 'No comments yet'}
              </p>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {filteredComments.map((comment) => (
                  <CommentModerationCard
                    key={comment.id}
                    comment={comment}
                    onMarkRead={(id, isRead) => markRead.mutate({ commentId: id, isRead })}
                    onResolve={(id, isResolved) => resolve.mutate({ commentId: id, isResolved })}
                    onHide={(id, isHidden, reason) => hide.mutate({ commentId: id, isHidden, reason })}
                    onAddReply={(id, reply) => addReply.mutate({ commentId: id, reply })}
                    onDeleteReply={(id) => deleteReply.mutate(id)}
                    isUpdating={isUpdating}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
