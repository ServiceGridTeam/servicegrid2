/**
 * PortalMessages page
 * Customer-facing messaging interface for customer threads
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePortalSession } from '@/hooks/usePortalSession';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Send, 
  MessageSquare, 
  Paperclip, 
  ArrowDown,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageTime, triggerHaptic, formatFileSize } from '@/lib/messageUtils';
import { AttachmentPreview } from '@/components/messaging/AttachmentPreview';
import { useAttachmentUpload } from '@/hooks/useAttachmentUpload';
import { toast } from 'sonner';
import type { Tables, Json } from '@/integrations/supabase/types';
import type { Attachment } from '@/lib/messageUtils';

interface PortalMessage extends Tables<'messages'> {
  sender_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

const PAGE_SIZE = 30;

export function PortalMessages() {
  const { activeBusinessId, activeCustomerId, customerAccountId } = usePortalSession();
  const queryClient = useQueryClient();
  
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { uploadAttachments, isUploading, progress } = useAttachmentUpload();

  // Find or create customer thread
  useEffect(() => {
    async function initializeThread() {
      if (!activeBusinessId || !activeCustomerId) {
        setIsInitializing(false);
        return;
      }

      try {
        // Look for existing customer thread
        const { data: existing, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('business_id', activeBusinessId)
          .eq('customer_id', activeCustomerId)
          .eq('type', 'customer_thread')
          .eq('status', 'active')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error finding conversation:', error);
        }

        if (existing) {
          setConversationId(existing.id);
        }
        // If no existing thread, we'll create one when they send their first message
      } catch (err) {
        console.error('Error initializing thread:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initializeThread();
  }, [activeBusinessId, activeCustomerId]);

  // Fetch messages
  const messagesQuery = useInfiniteQuery({
    queryKey: ['portal-messages', conversationId],
    queryFn: async ({ pageParam = null }) => {
      if (!conversationId) return { data: [], nextCursor: null };

      let query = supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!messages_sender_profile_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;

      const messages = (data || []).map((msg) => ({
        ...msg,
        sender_profile: Array.isArray(msg.sender_profile) 
          ? msg.sender_profile[0] || null 
          : msg.sender_profile,
      })) as PortalMessage[];

      const nextCursor = messages.length === PAGE_SIZE 
        ? messages[messages.length - 1]?.created_at 
        : null;

      return { data: messages, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: !!conversationId,
  });

  const messages = useMemo(() => 
    (messagesQuery.data?.pages.flatMap((p) => p.data) || []).reverse(),
    [messagesQuery.data]
  );

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`portal-messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['portal-messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Handle scroll for button visibility
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Create conversation and send first message
  const createAndSendMutation = useMutation({
    mutationFn: async ({ message, attachments: atts }: { message: string; attachments: Attachment[] }) => {
      if (!activeBusinessId || !activeCustomerId || !customerAccountId) {
        throw new Error('Not authenticated');
      }

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          business_id: activeBusinessId,
          customer_id: activeCustomerId,
          type: 'customer_thread',
          status: 'active',
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add customer as participant
      await supabase.from('conversation_participants').insert({
        conversation_id: conversation.id,
        customer_account_id: customerAccountId,
      });

      // Send the message
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_customer_id: customerAccountId,
          sender_name: 'Customer',
          content: message,
          attachments: atts.length > 0 ? (atts as unknown as Json) : null,
        })
        .select()
        .single();

      if (msgError) throw msgError;

      return { conversation, message: msg };
    },
    onSuccess: ({ conversation }) => {
      setConversationId(conversation.id);
      setContent('');
      setAttachments([]);
      setPendingFiles([]);
      triggerHaptic();
      toast.success('Message sent');
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    },
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ message, attachments: atts }: { message: string; attachments: Attachment[] }) => {
      if (!conversationId || !customerAccountId) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_customer_id: customerAccountId,
          sender_name: 'Customer',
          content: message,
          attachments: atts.length > 0 ? (atts as unknown as Json) : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setContent('');
      setAttachments([]);
      setPendingFiles([]);
      triggerHaptic();
      queryClient.invalidateQueries({ queryKey: ['portal-messages', conversationId] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    },
  });

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && attachments.length === 0 && pendingFiles.length === 0) return;
    if (isUploading || sendMutation.isPending || createAndSendMutation.isPending) return;

    let finalAttachments = [...attachments];

    // Upload pending files if there's a conversation
    if (pendingFiles.length > 0 && conversationId) {
      const uploaded = await uploadAttachments(pendingFiles, conversationId);
      finalAttachments = [...finalAttachments, ...uploaded];
    }

    if (conversationId) {
      sendMutation.mutate({ message: trimmedContent, attachments: finalAttachments });
    } else {
      // Create conversation with first message
      createAndSendMutation.mutate({ message: trimmedContent, attachments: finalAttachments });
    }
  }, [content, attachments, pendingFiles, conversationId, isUploading, sendMutation, createAndSendMutation, uploadAttachments]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    setPendingFiles((prev) => [...prev, ...newFiles]);

    const newAttachments: Attachment[] = newFiles.map((file, index) => ({
      id: `pending-${Date.now()}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' as const : 
            file.type.startsWith('video/') ? 'video' as const : 'file' as const,
      mimeType: file.type,
      size: file.size,
      processingStatus: 'pending' as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    setPendingFiles((prev) => {
      const index = attachments.findIndex((a) => a.id === attachmentId);
      if (index >= 0 && attachmentId.startsWith('pending-')) {
        return prev.filter((_, i) => i !== index);
      }
      return prev;
    });
  }, [attachments]);

  const isSending = sendMutation.isPending || createAndSendMutation.isPending || isUploading;
  const canSend = (content.trim() || attachments.length > 0) && !isSending;

  // Loading state
  if (isInitializing) {
    return (
      <div className="h-[calc(100vh-200px)] flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-16 w-2/3 ml-auto" />
          <Skeleton className="h-16 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-background rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-medium">Messages</h2>
          <p className="text-xs text-muted-foreground">
            Chat with our team
          </p>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {!conversationId && messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">Start a Conversation</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Send us a message and we'll get back to you as soon as possible.
            </p>
          </div>
        ) : (
          <>
            {messagesQuery.isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {messages.map((message) => {
                const isOwn = !!message.sender_customer_id;
                const senderName = message.sender_name || 'Team Member';
                const initials = senderName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-3',
                      isOwn ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    {!isOwn && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={message.sender_profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-muted">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div className={cn('flex flex-col max-w-[75%]', isOwn && 'items-end')}>
                      {!isOwn && (
                        <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                          <span className="font-medium">{senderName}</span>
                          <span>{formatMessageTime(message.created_at)}</span>
                        </div>
                      )}

                      <div
                        className={cn(
                          'px-4 py-2 rounded-2xl',
                          isOwn
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        {message.attachments && Array.isArray(message.attachments) && (
                          <AttachmentPreview 
                            attachments={message.attachments as unknown as Attachment[]} 
                            isOwn={isOwn}
                          />
                        )}
                      </div>

                      {isOwn && (
                        <span className="text-[10px] text-muted-foreground mt-0.5">
                          {formatMessageTime(message.created_at)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2"
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

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="flex gap-2 px-4 py-2 overflow-x-auto">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="relative shrink-0 group">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="h-16 w-16 object-cover rounded-md"
                    />
                  ) : (
                    <div className="h-16 w-16 flex flex-col items-center justify-center bg-muted rounded-md">
                      <span className="text-[10px] text-muted-foreground truncate max-w-[56px]">
                        {attachment.name}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="border-t bg-card p-4">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx"
          />

          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={isSending}
            className="min-h-[40px] max-h-[120px] resize-none py-2"
            rows={1}
          />

          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={!canSend}
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PortalMessages;
