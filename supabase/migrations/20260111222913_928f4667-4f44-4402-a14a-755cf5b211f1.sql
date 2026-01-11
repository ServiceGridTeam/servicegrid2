-- Phase 5: Fix RLS Infinite Recursion Bug in Messaging Tables
-- Create SECURITY DEFINER helper functions to break recursion cycle

-- Helper: Check if user is a participant in a conversation
CREATE OR REPLACE FUNCTION is_conversation_participant(
  _conversation_id uuid, 
  _profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = _conversation_id
      AND profile_id = _profile_id
      AND left_at IS NULL
  )
$$;

-- Helper: Check if user can manage a conversation (is participant with appropriate role)
CREATE OR REPLACE FUNCTION can_manage_conversation(
  _conversation_id uuid,
  _profile_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = _conversation_id
      AND cp.profile_id = _profile_id
      AND cp.left_at IS NULL
  )
$$;

-- Drop all broken policies on conversation_participants
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
DROP POLICY IF EXISTS "Participants can add members" ON conversation_participants;
DROP POLICY IF EXISTS "Users can leave conversations" ON conversation_participants;

-- Drop all broken policies on conversations
DROP POLICY IF EXISTS "Users can view participated conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Business members can create" ON conversations;
DROP POLICY IF EXISTS "Participants can update" ON conversations;

-- Drop all broken policies on messages
DROP POLICY IF EXISTS "Users can view conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can edit own messages within window" ON messages;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Senders can edit within window" ON messages;
DROP POLICY IF EXISTS "Users can soft delete own messages" ON messages;

-- =============================================
-- CONVERSATION_PARTICIPANTS POLICIES
-- =============================================

-- SELECT: Can view own participation OR if you're a participant in the same conversation
CREATE POLICY "cp_select_policy" ON conversation_participants
FOR SELECT USING (
  profile_id = auth.uid() 
  OR is_conversation_participant(conversation_id)
);

-- INSERT: Can add self to any conversation, or add others if already a participant
CREATE POLICY "cp_insert_policy" ON conversation_participants
FOR INSERT WITH CHECK (
  profile_id = auth.uid() 
  OR is_conversation_participant(conversation_id)
);

-- UPDATE: Can only update own participation record
CREATE POLICY "cp_update_policy" ON conversation_participants
FOR UPDATE USING (profile_id = auth.uid());

-- DELETE: Can only remove self from conversations
CREATE POLICY "cp_delete_policy" ON conversation_participants
FOR DELETE USING (profile_id = auth.uid());

-- =============================================
-- CONVERSATIONS POLICIES
-- =============================================

-- SELECT: Can view if you're a participant
CREATE POLICY "conv_select_policy" ON conversations
FOR SELECT USING (is_conversation_participant(id));

-- INSERT: Any authenticated user in the business can create conversations
CREATE POLICY "conv_insert_policy" ON conversations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_memberships bm
    WHERE bm.user_id = auth.uid()
      AND bm.business_id = conversations.business_id
      AND bm.status = 'active'
  )
);

-- UPDATE: Participants can update conversation metadata
CREATE POLICY "conv_update_policy" ON conversations
FOR UPDATE USING (is_conversation_participant(id));

-- =============================================
-- MESSAGES POLICIES  
-- =============================================

-- SELECT: Can view if participant in the conversation
CREATE POLICY "msg_select_policy" ON messages
FOR SELECT USING (is_conversation_participant(conversation_id));

-- INSERT: Can send if you're a participant and sender is self
CREATE POLICY "msg_insert_policy" ON messages
FOR INSERT WITH CHECK (
  sender_profile_id = auth.uid()
  AND is_conversation_participant(conversation_id)
);

-- UPDATE: Can edit own messages within 15 min window and not deleted
CREATE POLICY "msg_update_policy" ON messages
FOR UPDATE USING (
  sender_profile_id = auth.uid()
  AND created_at > (now() - interval '15 minutes')
  AND NOT is_deleted
);

-- DELETE: Can soft-delete own messages (we use is_deleted flag, but allow actual delete for cleanup)
CREATE POLICY "msg_delete_policy" ON messages
FOR DELETE USING (sender_profile_id = auth.uid());