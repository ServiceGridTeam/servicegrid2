/**
 * MessageThread component
 * Displays message list with infinite scroll, date grouping, and real-time updates
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowDown, MessageSquare } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { TypingIndicator } from './TypingIndicator';
import { useMessages, type MessageWithDetails } from '@/hooks/useMessages';
import { useReadReceipts } from '@/hooks/useReadReceipts';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import type { Attachment } from '@/lib/messageUtils';

interface MessageThreadProps {
  conversationId: string;
  className?: string;
}

interface GroupedMessages {
  date: string;
  label: string;
  messages: MessageWithDetails[];
}

export function MessageThread({ conversationId, className }: MessageThreadProps) {
  const { user } = useAuth();
  const { activeRole } = useBusinessContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageWithDetails | null>(null);
  const isLoadingMore = useRef(false);
  const lastScrollHeight = useRef(0);

  const {
    messages,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    typingUsers,
    markAsRead,
  } = useMessages(conversationId);

  const { receiptsByMessage } = useReadReceipts({ conversationId });

  // Group messages by date
  const groupedMessages = useMemo((): GroupedMessages[] => {
    const groups: Map<string, MessageWithDetails[]> = new Map();

    messages.forEach((message) => {
      const date = new Date(message.created_at);
      const dateKey = format(date, 'yyyy-MM-dd');
      
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(message);
    });

    return Array.from(groups.entries()).map(([date, msgs]) => {
      const d = new Date(date);
      let label: string;
      
      if (isToday(d)) {
        label = 'Today';
      } else if (isYesterday(d)) {
        label = 'Yesterday';
      } else {
        label = format(d, 'MMMM d, yyyy');
      }

      return { date, label, messages: msgs };
    });
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (bottomRef.current && !isLoadingMore.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Restore scroll position after loading more
  useEffect(() => {
    if (isLoadingMore.current && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - lastScrollHeight.current;
      scrollRef.current.scrollTop = scrollDiff;
      isLoadingMore.current = false;
    }
  }, [messages]);

  // Mark as read when viewing
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      markAsRead();
    }
  }, [messages.length, isLoading, markAsRead]);

  // Infinite scroll - load more on scroll to top
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Show scroll button if not at bottom
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);

    // Load more when near top
    if (scrollTop < 100 && hasNextPage && !isFetchingNextPage) {
      isLoadingMore.current = true;
      lastScrollHeight.current = scrollHeight;
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleSend = useCallback(
    (content: string, attachments?: Attachment[], replyToId?: string) => {
      sendMessage({
        content,
        attachments,
        replyToId,
      });
      setReplyTo(null);
    },
    [sendMessage]
  );

  const handleReply = useCallback((message: MessageWithDetails) => {
    setReplyTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Check if we should show sender for a message (hide if same sender as previous)
  const shouldShowSender = (message: MessageWithDetails, index: number): boolean => {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    if (!prevMessage) return true;
    
    // Show sender if different user or more than 5 minutes apart
    if (message.sender_profile_id !== prevMessage.sender_profile_id) return true;
    
    const timeDiff = new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime();
    return timeDiff > 5 * 60 * 1000;
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4"
        onScroll={handleScroll}
      >
        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Beginning of conversation */}
        {!hasNextPage && messages.length > 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Beginning of conversation
            </p>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation
            </p>
          </div>
        )}

        {/* Messages grouped by date */}
        <div className="py-4 space-y-6" ref={topRef}>
          <AnimatePresence mode="popLayout">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages.map((message, idx) => {
                    const globalIndex = messages.findIndex((m) => m.id === message.id);
                    const receipts = receiptsByMessage[message.id] || [];
                    // Filter out sender's own receipt for display
                    const displayReceipts = receipts.filter(r => r.reader_profile_id !== message.sender_profile_id);
                    
                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwn={message.sender_profile_id === user?.id}
                        userId={user?.id || null}
                        userRole={activeRole}
                        onEdit={editMessage}
                        onDelete={deleteMessage}
                        onReply={handleReply}
                        showSender={shouldShowSender(message, globalIndex)}
                        readReceipts={displayReceipts}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        {/* Bottom anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-24 right-6"
          >
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg"
              onClick={scrollToBottom}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <MessageComposer
        conversationId={conversationId}
        onSend={handleSend}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
      />
    </div>
  );
}
