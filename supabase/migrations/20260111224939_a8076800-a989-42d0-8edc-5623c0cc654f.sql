-- =====================================================
-- Phase 5.2: Fix RLS Infinite Recursion - Final Solution
-- Creates all needed helper functions and messaging policies
-- =====================================================

-- Step 1: Drop ONLY messaging-related problematic policies
-- =========================================================

DROP POLICY IF EXISTS "cp_select_via_function" ON conversation_participants;
DROP POLICY IF EXISTS "cp_select_own" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert" ON conversation_participants;
DROP POLICY IF EXISTS "cp_update_own" ON conversation_participants;
DROP POLICY IF EXISTS "cp_delete_own" ON conversation_participants;
DROP POLICY IF EXISTS "cp_select_self_or_admin" ON conversation_participants;
DROP POLICY IF EXISTS "cp_insert_policy" ON conversation_participants;
DROP POLICY IF EXISTS "cp_update_self" ON conversation_participants;
DROP POLICY IF EXISTS "cp_delete_self_or_admin" ON conversation_participants;

DROP POLICY IF EXISTS "conv_select" ON conversations;
DROP POLICY IF EXISTS "conv_insert" ON conversations;
DROP POLICY IF EXISTS "conv_update" ON conversations;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;

DROP POLICY IF EXISTS "msg_select" ON messages;
DROP POLICY IF EXISTS "msg_insert" ON messages;
DROP POLICY IF EXISTS "msg_update" ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;

-- Step 2: Create/Update helper functions
-- =======================================

-- Drop old messaging functions
DROP FUNCTION IF EXISTS get_user_conversation_ids(uuid);
DROP FUNCTION IF EXISTS is_participant_in_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS check_conversation_participant(uuid, uuid);

-- Create is_business_admin_or_owner function (via business_memberships)
CREATE OR REPLACE FUNCTION is_business_admin_or_owner(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_memberships 
    WHERE user_id = auth.uid() 
      AND business_id = p_business_id 
      AND status = 'active'
      AND role IN ('admin', 'owner')
  )
$$;

-- Create safe participant check function (ONLY for conversations/messages policies)
CREATE OR REPLACE FUNCTION check_conversation_participant(p_conversation_id uuid, p_profile_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
      AND profile_id = p_profile_id
      AND left_at IS NULL
  );
END;
$$;

-- Step 3: Create SIMPLE policies for conversation_participants
-- These NEVER query conversation_participants - safe from recursion
-- ==================================================================

-- SELECT: Own rows + admin check via business_memberships
CREATE POLICY "cp_select_self_or_admin" ON conversation_participants
FOR SELECT USING (
  profile_id = auth.uid()
  OR is_business_admin_or_owner(
    (SELECT business_id FROM conversations WHERE id = conversation_id)
  )
);

-- INSERT: Must belong to the business
CREATE POLICY "cp_insert_policy" ON conversation_participants
FOR INSERT WITH CHECK (
  user_belongs_to_business(
    (SELECT business_id FROM conversations WHERE id = conversation_id)
  )
);

-- UPDATE: Only self
CREATE POLICY "cp_update_self" ON conversation_participants
FOR UPDATE USING (profile_id = auth.uid());

-- DELETE: Self or admin
CREATE POLICY "cp_delete_self_or_admin" ON conversation_participants
FOR DELETE USING (
  profile_id = auth.uid()
  OR is_business_admin_or_owner(
    (SELECT business_id FROM conversations WHERE id = conversation_id)
  )
);

-- Step 4: Create policies for conversations table
-- ================================================

-- SELECT: Must be in business AND (participant OR admin)
CREATE POLICY "conversations_select" ON conversations
FOR SELECT USING (
  user_belongs_to_business(business_id)
  AND (
    check_conversation_participant(id)
    OR is_business_admin_or_owner(business_id)
  )
);

-- INSERT: Must belong to business
CREATE POLICY "conversations_insert" ON conversations
FOR INSERT WITH CHECK (
  user_belongs_to_business(business_id)
);

-- UPDATE: Must be participant or admin
CREATE POLICY "conversations_update" ON conversations
FOR UPDATE USING (
  check_conversation_participant(id)
  OR is_business_admin_or_owner(business_id)
);

-- Step 5: Create policies for messages table
-- ===========================================

-- SELECT: Must be participant
CREATE POLICY "messages_select" ON messages
FOR SELECT USING (
  check_conversation_participant(conversation_id)
);

-- INSERT: Must be sender and participant
CREATE POLICY "messages_insert" ON messages
FOR INSERT WITH CHECK (
  sender_profile_id = auth.uid()
  AND check_conversation_participant(conversation_id)
);

-- UPDATE: Own messages within 15 min, not deleted
CREATE POLICY "messages_update" ON messages
FOR UPDATE USING (
  sender_profile_id = auth.uid()
  AND created_at > (now() - interval '15 minutes')
  AND NOT is_deleted
);