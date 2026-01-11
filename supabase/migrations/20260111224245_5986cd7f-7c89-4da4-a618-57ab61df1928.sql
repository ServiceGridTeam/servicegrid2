-- Fix RLS Infinite Recursion (Final Solution)
-- The cp_select_same_conversation policy causes infinite recursion
-- by querying conversation_participants within its own policy

-- Step 1: Drop the problematic self-referencing policy
DROP POLICY IF EXISTS "cp_select_same_conversation" ON conversation_participants;

-- Step 2: Create helper function that returns user's conversation IDs
-- This function is SECURITY DEFINER so it bypasses RLS, breaking the recursion chain
CREATE OR REPLACE FUNCTION get_user_conversation_ids(p_profile_id uuid DEFAULT auth.uid())
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(conversation_id), ARRAY[]::uuid[])
  FROM conversation_participants
  WHERE profile_id = p_profile_id
    AND left_at IS NULL
$$;

-- Step 3: Create new policy using the helper function
-- Users can see their own rows directly, OR see other participants in conversations they're part of
CREATE POLICY "cp_select_via_function" ON conversation_participants
FOR SELECT USING (
  profile_id = auth.uid()
  OR conversation_id = ANY(get_user_conversation_ids())
);