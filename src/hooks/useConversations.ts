/**
 * useConversations hook
 * Provides conversation list, filtering, creation, and real-time updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessContext } from '@/hooks/useBusinessContext';
import { triggerHaptic, triggerErrorHaptic } from '@/lib/messageUtils';
import { toast } from 'sonner';
import type { Tables, TablesInsert, Enums } from '@/integrations/supabase/types';

export type ConversationType = Enums<'conversation_type'>;
export type ConversationStatus = Enums<'conversation_status'>;
export type ConversationFilter = 'all' | 'my_direct' | 'customer' | 'team' | 'job';

export interface ConversationWithDetails extends Tables<'conversations'> {
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  job?: {
    id: string;
    job_number: string;
    title: string;
  } | null;
  assigned_worker?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  my_participant?: {
    unread_count: number;
    unread_mention_count: number;
    last_read_at: string | null;
  } | null;
}

interface UseConversationsOptions {
  filter?: ConversationFilter;
  status?: ConversationStatus;
  jobId?: string;
  customerId?: string;
}

interface CreateConversationInput {
  type: ConversationType;
  title?: string;
  jobId?: string;
  customerId?: string;
  quoteId?: string;
  invoiceId?: string;
  participantIds?: string[];
}

export function useConversations(options: UseConversationsOptions = {}) {
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();
  const queryClient = useQueryClient();

  const queryKey = ['conversations', activeBusinessId, options];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!activeBusinessId) return [];

      let q = supabase
        .from('conversations')
        .select(`
          *,
          customer:customers!conversations_customer_id_fkey(id, first_name, last_name),
          job:jobs!conversations_job_id_fkey(id, job_number, title),
          assigned_worker:profiles!conversations_assigned_to_fkey(id, first_name, last_name),
          my_participant:conversation_participants!inner(unread_count, unread_mention_count, last_read_at)
        `)
        .eq('business_id', activeBusinessId)
        .eq('conversation_participants.profile_id', user?.id || '')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      // Apply status filter
      if (options.status) {
        q = q.eq('status', options.status);
      } else {
        // Default to active conversations
        q = q.eq('status', 'active');
      }

      // Apply type-based filters
      if (options.filter === 'customer') {
        q = q.eq('type', 'customer_thread');
      } else if (options.filter === 'team') {
        q = q.eq('type', 'team_chat');
      } else if (options.filter === 'job') {
        q = q.eq('type', 'job_discussion');
      } else if (options.filter === 'my_direct') {
        // Filter to customer threads assigned to current user
        q = q.eq('type', 'customer_thread').eq('assigned_to', user?.id || '');
      }

      // Filter by specific job
      if (options.jobId) {
        q = q.eq('job_id', options.jobId);
      }

      // Filter by specific customer
      if (options.customerId) {
        q = q.eq('customer_id', options.customerId);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Transform the nested participant data
      return (data || []).map((conv) => ({
        ...conv,
        my_participant: Array.isArray(conv.my_participant) 
          ? conv.my_participant[0] || null 
          : conv.my_participant,
      })) as ConversationWithDetails[];
    },
    enabled: !!activeBusinessId && !!user?.id,
  });

  // Calculate total unread counts
  const { totalUnread, totalUnreadMentions } = useMemo(() => {
    if (!query.data) return { totalUnread: 0, totalUnreadMentions: 0 };
    
    return query.data.reduce(
      (acc, conv) => ({
        totalUnread: acc.totalUnread + (conv.my_participant?.unread_count || 0),
        totalUnreadMentions: acc.totalUnreadMentions + (conv.my_participant?.unread_mention_count || 0),
      }),
      { totalUnread: 0, totalUnreadMentions: 0 }
    );
  }, [query.data]);

  // Real-time subscription
  useEffect(() => {
    if (!activeBusinessId) return;

    const channel = supabase
      .channel(`conversations:${activeBusinessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${activeBusinessId}`,
        },
        (payload) => {
          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: ['conversations', activeBusinessId] });
          
          // Haptic for new messages in existing conversations
          if (payload.eventType === 'UPDATE' && payload.new.last_message_at !== payload.old?.last_message_at) {
            triggerHaptic(25);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBusinessId, queryClient]);

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: async (input: CreateConversationInput) => {
      if (!activeBusinessId || !user?.id) throw new Error('Not authenticated');

      triggerHaptic();

      // Create the conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          business_id: activeBusinessId,
          type: input.type,
          title: input.title || null,
          job_id: input.jobId || null,
          customer_id: input.customerId || null,
          quote_id: input.quoteId || null,
          invoice_id: input.invoiceId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add creator as participant
      const participantInserts: TablesInsert<'conversation_participants'>[] = [
        {
          conversation_id: conversation.id,
          profile_id: user.id,
        },
      ];

      // Add additional participants
      if (input.participantIds) {
        for (const profileId of input.participantIds) {
          if (profileId !== user.id) {
            participantInserts.push({
              conversation_id: conversation.id,
              profile_id: profileId,
            });
          }
        }
      }

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);

      if (partError) throw partError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', activeBusinessId] });
      toast.success('Conversation created');
    },
    onError: (error) => {
      triggerErrorHaptic();
      toast.error('Failed to create conversation');
      console.error('Create conversation error:', error);
    },
  });

  // Assign conversation mutation
  const assignMutation = useMutation({
    mutationFn: async ({ conversationId, workerId }: { conversationId: string; workerId: string | null }) => {
      if (!activeBusinessId || !user?.id) throw new Error('Not authenticated');

      triggerHaptic(5);

      const { data, error } = await supabase
        .from('conversations')
        .update({
          assigned_to: workerId,
          assigned_at: workerId ? new Date().toISOString() : null,
        })
        .eq('id', conversationId)
        .eq('business_id', activeBusinessId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('conversation_activities').insert({
        conversation_id: conversationId,
        activity_type: workerId ? 'assigned' : 'reassigned',
        actor_id: user.id,
        new_value: workerId ? { assigned_to: workerId } : null,
      });

      // Add new assignee as participant if not already
      if (workerId) {
        await supabase
          .from('conversation_participants')
          .upsert({
            conversation_id: conversationId,
            profile_id: workerId,
          }, {
            onConflict: 'conversation_id,profile_id',
            ignoreDuplicates: true,
          });
      }

      return data;
    },
    onMutate: async ({ conversationId, workerId }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ConversationWithDetails[]>(queryKey);
      
      queryClient.setQueryData<ConversationWithDetails[]>(queryKey, (old) =>
        old?.map((conv) =>
          conv.id === conversationId
            ? { ...conv, assigned_to: workerId, assigned_at: new Date().toISOString() }
            : conv
        )
      );

      return { previous };
    },
    onError: (error, _, context) => {
      triggerErrorHaptic();
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error('Failed to assign conversation');
      console.error('Assign conversation error:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', activeBusinessId] });
    },
  });

  // Archive conversation mutation
  const archiveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!activeBusinessId || !user?.id) throw new Error('Not authenticated');

      triggerHaptic(25);

      const { data, error } = await supabase
        .from('conversations')
        .update({ status: 'archived' })
        .eq('id', conversationId)
        .eq('business_id', activeBusinessId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('conversation_activities').insert({
        conversation_id: conversationId,
        activity_type: 'archived',
        actor_id: user.id,
      });

      return data;
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ConversationWithDetails[]>(queryKey);
      
      // Remove from list (optimistic)
      queryClient.setQueryData<ConversationWithDetails[]>(queryKey, (old) =>
        old?.filter((conv) => conv.id !== conversationId)
      );

      return { previous };
    },
    onError: (error, _, context) => {
      triggerErrorHaptic();
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error('Failed to archive conversation');
      console.error('Archive conversation error:', error);
    },
    onSuccess: () => {
      toast.success('Conversation archived');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', activeBusinessId] });
    },
  });

  // Unarchive conversation mutation
  const unarchiveMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!activeBusinessId || !user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('conversations')
        .update({ status: 'active' })
        .eq('id', conversationId)
        .eq('business_id', activeBusinessId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('conversation_activities').insert({
        conversation_id: conversationId,
        activity_type: 'unarchived',
        actor_id: user.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', activeBusinessId] });
      toast.success('Conversation restored');
    },
    onError: (error) => {
      triggerErrorHaptic();
      toast.error('Failed to restore conversation');
      console.error('Unarchive conversation error:', error);
    },
  });

  // Get or create conversation for a job
  const getOrCreateJobDiscussion = useCallback(
    async (jobId: string): Promise<ConversationWithDetails> => {
      if (!activeBusinessId || !user?.id) throw new Error('Not authenticated');

      // Check if conversation exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('business_id', activeBusinessId)
        .eq('job_id', jobId)
        .eq('type', 'job_discussion')
        .maybeSingle();

      if (existing) {
        return existing as ConversationWithDetails;
      }

      // Create new
      const created = await createMutation.mutateAsync({
        type: 'job_discussion',
        jobId,
      });

      return created as ConversationWithDetails;
    },
    [activeBusinessId, user?.id, createMutation]
  );

  return {
    conversations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    
    totalUnread,
    totalUnreadMentions,
    
    createConversation: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    
    assignConversation: (conversationId: string, workerId: string | null) =>
      assignMutation.mutate({ conversationId, workerId }),
    isAssigning: assignMutation.isPending,
    
    archiveConversation: archiveMutation.mutate,
    isArchiving: archiveMutation.isPending,
    
    unarchiveConversation: unarchiveMutation.mutate,
    isUnarchiving: unarchiveMutation.isPending,
    
    getOrCreateJobDiscussion,
  };
}

/**
 * Hook to get a single conversation by ID
 */
export function useConversation(conversationId: string | null | undefined) {
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId || !activeBusinessId) return null;

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          customer:customers!conversations_customer_id_fkey(id, first_name, last_name, email, phone),
          job:jobs!conversations_job_id_fkey(id, job_number, title),
          assigned_worker:profiles!conversations_assigned_to_fkey(id, first_name, last_name, avatar_url),
          participants:conversation_participants(
            id,
            profile_id,
            customer_account_id,
            unread_count,
            last_read_at,
            profile:profiles(id, first_name, last_name, avatar_url)
          )
        `)
        .eq('id', conversationId)
        .eq('business_id', activeBusinessId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && !!activeBusinessId && !!user?.id,
  });
}

/**
 * Hook to get unread count across all conversations
 */
export function useUnreadConversationsCount() {
  const { user } = useAuth();
  const { activeBusinessId } = useBusinessContext();

  return useQuery({
    queryKey: ['conversations-unread-count', activeBusinessId],
    queryFn: async () => {
      if (!activeBusinessId || !user?.id) return { totalUnread: 0, totalMentions: 0 };

      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          unread_count,
          unread_mention_count,
          conversation:conversations!inner(business_id, status)
        `)
        .eq('profile_id', user.id)
        .eq('conversations.business_id', activeBusinessId)
        .eq('conversations.status', 'active');

      if (error) throw error;

      const totals = (data || []).reduce(
        (acc, p) => ({
          totalUnread: acc.totalUnread + (p.unread_count || 0),
          totalMentions: acc.totalMentions + (p.unread_mention_count || 0),
        }),
        { totalUnread: 0, totalMentions: 0 }
      );

      return totals;
    },
    enabled: !!activeBusinessId && !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
