/**
 * useReadReceipts hook
 * Fetches read receipts for messages in a conversation
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ReadReceipt {
  id: string;
  message_id: string;
  reader_profile_id: string | null;
  reader_customer_id: string | null;
  read_at: string;
  reader_name?: string;
  reader_avatar?: string | null;
}

interface UseReadReceiptsOptions {
  conversationId: string | null | undefined;
}

export function useReadReceipts({ conversationId }: UseReadReceiptsOptions) {
  const query = useQuery({
    queryKey: ['read-receipts', conversationId],
    queryFn: async (): Promise<Record<string, ReadReceipt[]>> => {
      if (!conversationId) return {};

      // First get the message IDs for this conversation
      const { data: messages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false);

      if (!messages || messages.length === 0) return {};

      const messageIds = messages.map(m => m.id);

      const { data, error } = await supabase
        .from('message_read_receipts')
        .select('id, message_id, reader_profile_id, reader_customer_id, read_at')
        .in('message_id', messageIds);

      if (error) throw error;

      // Fetch profile info separately to avoid type recursion
      const profileIds = [...new Set((data || []).map(r => r.reader_profile_id).filter(Boolean))] as string[];
      
      let profileMap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
      
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', profileIds);
        
        (profiles || []).forEach(p => {
          profileMap[p.id] = p;
        });
      }

      // Group by message_id
      const receiptsByMessage: Record<string, ReadReceipt[]> = {};
      
      (data || []).forEach((receipt) => {
        const profile = receipt.reader_profile_id ? profileMap[receipt.reader_profile_id] : null;
        const readerName = profile
          ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
          : 'Customer';

        const formattedReceipt: ReadReceipt = {
          id: receipt.id,
          message_id: receipt.message_id,
          reader_profile_id: receipt.reader_profile_id,
          reader_customer_id: receipt.reader_customer_id,
          read_at: receipt.read_at,
          reader_name: readerName,
          reader_avatar: profile?.avatar_url || null,
        };

        if (!receiptsByMessage[receipt.message_id]) {
          receiptsByMessage[receipt.message_id] = [];
        }
        receiptsByMessage[receipt.message_id].push(formattedReceipt);
      });

      return receiptsByMessage;
    },
    enabled: !!conversationId,
    staleTime: 10000, // 10 seconds
  });

  return {
    receiptsByMessage: query.data || {},
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Get read status for a specific message
 */
export function getReadStatus(
  receipts: ReadReceipt[] | undefined,
  senderId: string | null
): { isRead: boolean; readers: ReadReceipt[] } {
  if (!receipts || receipts.length === 0) {
    return { isRead: false, readers: [] };
  }

  // Filter out sender's own receipt
  const otherReaders = receipts.filter((r) => r.reader_profile_id !== senderId);
  
  return {
    isRead: otherReaders.length > 0,
    readers: otherReaders,
  };
}
