/**
 * useMessages hook
 * Provides message loading, sending, editing, deletion, and real-time updates
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import {
  triggerHaptic,
  triggerErrorHaptic,
  generateTempId,
  canEditMessage,
  canDeleteMessage,
  parseEntityReferences,
  parseMentions,
  contentToHtml,
  type Attachment,
} from '@/lib/messageUtils';
import { toast } from 'sonner';
import type { Tables, Json } from '@/integrations/supabase/types';

const PAGE_SIZE = 50;

export interface MessageWithDetails extends Tables<'messages'> {
  sender_profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  reply_to?: {
    id: string;
    content: string;
    sender_name: string;
  } | null;
  isOptimistic?: boolean;
  isSending?: boolean;
  sendError?: string;
}

interface SendMessageInput {
  content: string;
  attachments?: Attachment[];
  replyToId?: string;
}

interface EditMessageInput {
  messageId: string;
  content: string;
  version: number;
}

interface TypingUser {
  profileId: string;
  name: string;
  timestamp: number;
}

export function useMessages(conversationId: string | null | undefined) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { activeBusinessId, activeRole } = useBusinessContext();
  const queryClient = useQueryClient();
  
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const queryKey = ['messages', conversationId];

  // Infinite scroll query for messages
  const messagesQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = null }) => {
      if (!conversationId) return { data: [], nextCursor: null };

      let query = supabase
        .from('messages')
        .select(`
          *,
          sender_profile:profiles!messages_sender_profile_id_fkey(id, first_name, last_name, avatar_url),
          reply_to:messages!messages_reply_to_id_fkey(id, content, sender_name)
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
        // Handle array response from join by picking first element
        reply_to: Array.isArray(msg.reply_to) ? msg.reply_to[0] || null : msg.reply_to,
        sender_profile: Array.isArray(msg.sender_profile) ? msg.sender_profile[0] || null : msg.sender_profile,
      }));
      
      const nextCursor = messages.length === PAGE_SIZE 
        ? messages[messages.length - 1]?.created_at 
        : null;

      return { data: messages as MessageWithDetails[], nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    enabled: !!conversationId,
  });

  // Flatten all pages into a single array (reversed to show oldest first)
  const messages = (messagesQuery.data?.pages.flatMap((p) => p.data) || []).reverse();

  // Real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as MessageWithDetails;
          
          // Don't add if it's our own optimistic message
          if (newMessage.sender_profile_id === user?.id) {
            // Just invalidate to sync
            queryClient.invalidateQueries({ queryKey });
          } else {
            // Add the new message optimistically and trigger haptic
            triggerHaptic(25);
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Message was edited or deleted, refetch
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user?.id, queryClient, queryKey]);

  // Typing indicator subscription
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase.channel(`typing:${conversationId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { profileId, name, isTyping } = payload.payload as {
          profileId: string;
          name: string;
          isTyping: boolean;
        };

        // Ignore own typing events
        if (profileId === user.id) return;

        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (isTyping) {
            next.set(profileId, { profileId, name, timestamp: Date.now() });
          } else {
            next.delete(profileId);
          }
          return next;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, user?.id]);

  // Clean up stale typing indicators (older than 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = new Map(prev);
        for (const [key, value] of next) {
          if (now - value.timestamp > 5000) {
            next.delete(key);
          }
        }
        return prev.size !== next.size ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Send typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !user?.id || !profile) return;

      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'User';

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { profileId: user.id, name, isTyping },
      });

      // Clear typing after 3 seconds of no activity
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'typing',
            payload: { profileId: user?.id, name, isTyping: false },
          });
        }, 3000);
      }
    },
    [user?.id, profile]
  );

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!conversationId || !user?.id || !profile) {
        throw new Error('Not authenticated');
      }

      const senderName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'User';
      
      // Parse content
      const entityRefs = parseEntityReferences(input.content);
      const mentions = parseMentions(input.content);
      const contentHtml = contentToHtml(input.content);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_profile_id: user.id,
          sender_name: senderName,
          content: input.content,
          content_html: contentHtml,
          attachments: (input.attachments || null) as unknown as Json,
          entity_references: (entityRefs.length > 0 ? entityRefs : null) as unknown as Json,
          mentions: (mentions.length > 0 ? mentions : null) as unknown as Json,
          reply_to_id: input.replyToId || null,
        })
        .select(`
          *,
          sender_profile:profiles!messages_sender_profile_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return data as unknown as MessageWithDetails;
    },
    onMutate: async (input) => {
      // 0ms haptic feedback
      triggerHaptic();

      // Stop typing indicator
      sendTyping(false);

      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous state
      const previous = queryClient.getQueryData(queryKey);

      // Create optimistic message
      const tempId = generateTempId();
      const senderName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';
      
      const optimisticMessage: MessageWithDetails = {
        id: tempId,
        conversation_id: conversationId!,
        sender_profile_id: user?.id || null,
        sender_customer_id: null,
        sender_name: senderName,
        content: input.content,
        content_html: contentToHtml(input.content),
        attachments: (input.attachments || null) as unknown as Json,
        entity_references: parseEntityReferences(input.content) as unknown as Json,
        mentions: parseMentions(input.content) as unknown as Json,
        reply_to_id: input.replyToId || null,
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null,
        version: 1,
        metadata: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_profile: profile ? {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url,
        } : null,
        isOptimistic: true,
        isSending: true,
      };

      // Add optimistic message to cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        const pages = [...old.pages];
        if (pages.length > 0) {
          pages[0] = {
            ...pages[0],
            data: [optimisticMessage, ...pages[0].data],
          };
        }
        return { ...old, pages };
      });

      return { previous, tempId };
    },
    onError: (err, _, context) => {
      triggerErrorHaptic();
      
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      
      toast.error('Failed to send message');
      console.error('Send message error:', err);
    },
    onSuccess: (data, _, context) => {
      // Replace optimistic message with real one
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        const pages = old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((msg: MessageWithDetails) =>
            msg.id === context?.tempId ? { ...data, isOptimistic: false, isSending: false } : msg
          ),
        }));
        return { ...old, pages };
      });
    },
    onSettled: () => {
      // Sync with server
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Edit message mutation
  const editMutation = useMutation({
    mutationFn: async ({ messageId, content, version }: EditMessageInput) => {
      if (!user?.id) throw new Error('Not authenticated');

      triggerHaptic(5);

      const contentHtml = contentToHtml(content);
      const entityRefs = parseEntityReferences(content);
      const mentions = parseMentions(content);

      const { data, error } = await supabase
        .from('messages')
        .update({
          content,
          content_html: contentHtml,
          entity_references: (entityRefs.length > 0 ? entityRefs : null) as unknown as Json,
          mentions: (mentions.length > 0 ? mentions : null) as unknown as Json,
          is_edited: true,
          edited_at: new Date().toISOString(),
          version: version + 1,
        })
        .eq('id', messageId)
        .eq('sender_profile_id', user.id)
        .eq('version', version) // Optimistic locking
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Message was modified by another user. Please refresh and try again.');
        }
        throw error;
      }

      return data;
    },
    onMutate: async ({ messageId, content }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Optimistic update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        const pages = old.pages.map((page: any) => ({
          ...page,
          data: page.data.map((msg: MessageWithDetails) =>
            msg.id === messageId
              ? {
                  ...msg,
                  content,
                  content_html: contentToHtml(content),
                  is_edited: true,
                  edited_at: new Date().toISOString(),
                }
              : msg
          ),
        }));
        return { ...old, pages };
      });

      return { previous };
    },
    onError: (err, _, context) => {
      triggerErrorHaptic();
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to edit message');
    },
    onSuccess: () => {
      toast.success('Message edited');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      triggerHaptic(25);

      const { error } = await supabase
        .from('messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          content: '[Message deleted]',
          content_html: null,
          attachments: null,
        })
        .eq('id', messageId);

      if (error) throw error;
    },
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      // Optimistic removal from view
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        
        const pages = old.pages.map((page: any) => ({
          ...page,
          data: page.data.filter((msg: MessageWithDetails) => msg.id !== messageId),
        }));
        return { ...old, pages };
      });

      return { previous };
    },
    onError: (err, _, context) => {
      triggerErrorHaptic();
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error('Failed to delete message');
      console.error('Delete message error:', err);
    },
    onSuccess: () => {
      toast.success('Message deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Mark conversation as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !user?.id) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    await supabase
      .from('conversation_participants')
      .update({
        last_read_at: new Date().toISOString(),
        last_read_message_id: latestMessage.id,
        unread_count: 0,
        unread_mention_count: 0,
      })
      .eq('conversation_id', conversationId)
      .eq('profile_id', user.id);

    // Invalidate unread counts
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    queryClient.invalidateQueries({ queryKey: ['conversations-unread-count'] });
  }, [conversationId, user?.id, messages, queryClient]);

  // Check permissions
  const checkCanEdit = useCallback(
    (message: MessageWithDetails) => canEditMessage(message, user?.id),
    [user?.id]
  );

  const checkCanDelete = useCallback(
    (message: MessageWithDetails) => canDeleteMessage(message, user?.id, activeRole),
    [user?.id, activeRole]
  );

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    
    fetchNextPage: messagesQuery.fetchNextPage,
    hasNextPage: messagesQuery.hasNextPage,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    
    sendMessage: sendMutation.mutate,
    sendMessageAsync: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    
    editMessage: (messageId: string, content: string, version: number) =>
      editMutation.mutate({ messageId, content, version }),
    isEditing: editMutation.isPending,
    
    deleteMessage: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    
    canEdit: checkCanEdit,
    canDelete: checkCanDelete,
    
    sendTyping,
    typingUsers,
    
    markAsRead,
  };
}

/**
 * Hook to get activities for a conversation
 */
export function useConversationActivities(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['conversation-activities', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('conversation_activities')
        .select(`
          *,
          actor:profiles!conversation_activities_actor_id_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
  });
}
