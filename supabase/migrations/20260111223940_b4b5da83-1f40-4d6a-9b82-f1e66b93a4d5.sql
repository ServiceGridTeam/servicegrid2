-- Phase 5: Fix RLS Infinite Recursion (Correct Approach)
-- First drop policies that depend on the function, then the function, then recreate

-- ============================================
-- STEP 1: Drop ALL existing policies (including the ones causing dependency issues)
-- ============================================

-- Drop conversation_participants policies
DROP POLICY IF EXISTS "cp_select_policy" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert_policy" ON conversation_participants;
DROP POLICY IF EXISTS "cp_update_policy" ON conversation_participants;
DROP POLICY IF EXISTS "cp_delete_policy" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants" ON conversation_participants;
DROP POLICY IF EXISTS "Participants can add members" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON conversation_participants;
DROP POLICY IF EXISTS "Users can leave conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "cp_select_v2" ON conversation_participants;
DROP POLICY IF EXISTS "cp_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "cp_select_same_conversation" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON conversation_participants;
DROP POLICY IF EXISTS "cp_update_own" ON conversation_participants;
DROP POLICY IF EXISTS "cp_delete_own" ON conversation_participants;

-- Drop conversations policies
DROP POLICY IF EXISTS "conv_select_policy" ON conversations;
DROP POLICY IF EXISTS "conv_insert_policy" ON conversations;
DROP POLICY IF EXISTS "conv_update_policy" ON conversations;
DROP POLICY IF EXISTS "conv_delete_policy" ON conversations;
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Business members can create" ON conversations;
DROP POLICY IF EXISTS "Participants can update" ON conversations;
DROP POLICY IF EXISTS "Users can view participated conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
DROP POLICY IF EXISTS "conv_select_v2" ON conversations;
DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "conv_update" ON conversations;

-- Drop messages policies
DROP POLICY IF EXISTS "msg_select_policy" ON messages;
DROP POLICY IF EXISTS "msg_insert_policy" ON messages;
DROP POLICY IF EXISTS "msg_update_policy" ON messages;
DROP POLICY IF EXISTS "msg_delete_policy" ON messages;
DROP POLICY IF EXISTS "Participants can view messages" ON messages;
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Senders can edit within window" ON messages;
DROP POLICY IF EXISTS "Users can view conversation messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can edit own messages within window" ON messages;
DROP POLICY IF EXISTS "msg_select_v2" ON messages;
DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "msg_update" ON messages;

-- ============================================
-- STEP 2: Now drop old helper functions (no dependencies left)
-- ============================================

DROP FUNCTION IF EXISTS is_conversation_participant(uuid, uuid);
DROP FUNCTION IF EXISTS can_manage_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS is_participant_in_conversation(uuid, uuid);

-- ============================================
-- STEP 3: Create plpgsql helper function (bypasses RLS)
-- ============================================

CREATE OR REPLACE FUNCTION is_participant_in_conversation(p_conversation_id uuid, p_profile_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- This function runs with SECURITY DEFINER, bypassing RLS
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND profile_id = p_profile_id
      AND left_at IS NULL
  ) INTO v_exists;
  
  RETURN COALESCE(v_exists, false);
END;
$$;

-- ============================================
-- STEP 4: Create conversation_participants policies
-- These MUST NOT call is_participant_in_conversation to avoid recursion
-- ============================================

-- SELECT: Users can see their own participations
CREATE POLICY "cp_select_own" ON conversation_participants
FOR SELECT USING (
  profile_id = auth.uid()
);

-- Additional SELECT for viewing other participants in same conversation
-- Uses a subquery that only references the user's own rows
CREATE POLICY "cp_select_same_conversation" ON conversation_participants
FOR SELECT USING (
  conversation_id IN (
    SELECT conversation_id FROM conversation_participants 
    WHERE profile_id = auth.uid() AND left_at IS NULL
  )
);

-- INSERT: Users can add themselves or add others if they're already a participant
CREATE POLICY "cp_insert" ON conversation_participants
FOR INSERT WITH CHECK (
  profile_id = auth.uid()
  OR conversation_id IN (
    SELECT conversation_id FROM conversation_participants 
    WHERE profile_id = auth.uid() AND left_at IS NULL
  )
);

-- UPDATE: Users can only update their own participation record
CREATE POLICY "cp_update_own" ON conversation_participants
FOR UPDATE USING (profile_id = auth.uid());

-- DELETE: Users can only remove themselves
CREATE POLICY "cp_delete_own" ON conversation_participants
FOR DELETE USING (profile_id = auth.uid());

-- ============================================
-- STEP 5: Create conversations policies
-- These CAN use is_participant_in_conversation safely
-- ============================================

-- SELECT: Participants can view conversations they're in
CREATE POLICY "conv_select" ON conversations
FOR SELECT USING (
  is_participant_in_conversation(id)
);

-- INSERT: Any authenticated user in the business can create conversations
CREATE POLICY "conv_insert" ON conversations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM business_memberships
    WHERE user_id = auth.uid()
      AND business_id = conversations.business_id
      AND status = 'active'
  )
);

-- UPDATE: Participants can update conversations
CREATE POLICY "conv_update" ON conversations
FOR UPDATE USING (
  is_participant_in_conversation(id)
);

-- ============================================
-- STEP 6: Create messages policies
-- These CAN use is_participant_in_conversation safely
-- ============================================

-- SELECT: Participants can view messages
CREATE POLICY "msg_select" ON messages
FOR SELECT USING (
  is_participant_in_conversation(conversation_id)
);

-- INSERT: Participants can send messages (as themselves)
CREATE POLICY "msg_insert" ON messages
FOR INSERT WITH CHECK (
  sender_profile_id = auth.uid()
  AND is_participant_in_conversation(conversation_id)
);

-- UPDATE: Senders can edit their own messages within 15 minute window
CREATE POLICY "msg_update" ON messages
FOR UPDATE USING (
  sender_profile_id = auth.uid()
  AND created_at > (now() - interval '15 minutes')
  AND NOT is_deleted
);