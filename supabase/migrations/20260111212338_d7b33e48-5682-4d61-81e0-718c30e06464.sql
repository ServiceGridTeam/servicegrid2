-- =============================================
-- TEAM MESSAGING: Phase 1 Database Foundation
-- =============================================

-- 1. Create conversation_type enum
CREATE TYPE conversation_type AS ENUM ('customer_thread', 'team_chat', 'job_discussion');

-- 2. Create conversation_status enum
CREATE TYPE conversation_status AS ENUM ('active', 'archived', 'resolved');

-- 3. Create activity_type enum
CREATE TYPE conversation_activity_type AS ENUM (
  'created', 'assigned', 'reassigned', 'participant_joined', 
  'participant_left', 'status_changed', 'archived', 'unarchived'
);

-- =============================================
-- TABLE: conversations
-- =============================================
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type conversation_type NOT NULL,
  status conversation_status NOT NULL DEFAULT 'active',
  title TEXT,
  
  -- Entity references (nullable based on type)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Assignment for customer threads
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Denormalized for performance
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_sender_name TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for conversations
CREATE INDEX idx_conversations_business_type ON public.conversations(business_id, type);
CREATE INDEX idx_conversations_business_status ON public.conversations(business_id, status);
CREATE INDEX idx_conversations_last_message ON public.conversations(business_id, last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_customer ON public.conversations(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_conversations_job ON public.conversations(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_conversations_assigned ON public.conversations(assigned_to) WHERE assigned_to IS NOT NULL;

-- =============================================
-- TABLE: conversation_participants
-- =============================================
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  
  -- XOR: Either profile_id OR customer_account_id, never both
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_account_id UUID REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  
  -- Read tracking
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  unread_count INTEGER NOT NULL DEFAULT 0,
  unread_mention_count INTEGER NOT NULL DEFAULT 0,
  
  -- Notification preferences
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT participant_xor CHECK (
    (profile_id IS NOT NULL AND customer_account_id IS NULL) OR
    (profile_id IS NULL AND customer_account_id IS NOT NULL)
  ),
  CONSTRAINT unique_profile_conversation UNIQUE (conversation_id, profile_id),
  CONSTRAINT unique_customer_conversation UNIQUE (conversation_id, customer_account_id)
);

-- Indexes for participants
CREATE INDEX idx_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX idx_participants_profile ON public.conversation_participants(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_participants_customer ON public.conversation_participants(customer_account_id) WHERE customer_account_id IS NOT NULL;
CREATE INDEX idx_participants_unread ON public.conversation_participants(profile_id, unread_count) WHERE unread_count > 0;

-- =============================================
-- TABLE: messages
-- =============================================
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  
  -- Sender identity (XOR: profile OR customer)
  sender_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_customer_id UUID REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  content_html TEXT,
  
  -- Attachments as JSONB array
  attachments JSONB DEFAULT '[]',
  
  -- Entity references parsed from content
  entity_references JSONB DEFAULT '[]',
  
  -- @mentions
  mentions JSONB DEFAULT '[]',
  
  -- Reply threading
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  
  -- Edit/delete tracking
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  -- Optimistic locking
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT sender_xor CHECK (
    (sender_profile_id IS NOT NULL AND sender_customer_id IS NULL) OR
    (sender_profile_id IS NULL AND sender_customer_id IS NOT NULL)
  )
);

-- Indexes for messages
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_profile ON public.messages(sender_profile_id) WHERE sender_profile_id IS NOT NULL;
CREATE INDEX idx_messages_sender_customer ON public.messages(sender_customer_id) WHERE sender_customer_id IS NOT NULL;
CREATE INDEX idx_messages_reply ON public.messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_messages_not_deleted ON public.messages(conversation_id, created_at DESC) WHERE is_deleted = false;

-- =============================================
-- TABLE: conversation_activities
-- =============================================
CREATE TABLE public.conversation_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  activity_type conversation_activity_type NOT NULL,
  
  -- Actor
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  
  -- Activity details
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for activities
CREATE INDEX idx_activities_conversation ON public.conversation_activities(conversation_id, created_at DESC);

-- =============================================
-- TABLE: message_read_receipts
-- =============================================
CREATE TABLE public.message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  
  -- Reader (XOR)
  reader_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reader_customer_id UUID REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT reader_xor CHECK (
    (reader_profile_id IS NOT NULL AND reader_customer_id IS NULL) OR
    (reader_profile_id IS NULL AND reader_customer_id IS NOT NULL)
  ),
  CONSTRAINT unique_profile_read UNIQUE (message_id, reader_profile_id),
  CONSTRAINT unique_customer_read UNIQUE (message_id, reader_customer_id)
);

-- Indexes for read receipts
CREATE INDEX idx_read_receipts_message ON public.message_read_receipts(message_id);

-- =============================================
-- TRIGGERS
-- =============================================

-- updated_at trigger for conversations
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- updated_at trigger for conversation_participants
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- updated_at trigger for messages
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Update conversation on new message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    last_message_sender_id = NEW.sender_profile_id,
    last_message_sender_name = NEW.sender_name,
    message_count = message_count + 1,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

-- Trigger: Increment unread counts for other participants
CREATE OR REPLACE FUNCTION public.increment_unread_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment unread_count for all participants except the sender
  UPDATE public.conversation_participants
  SET 
    unread_count = unread_count + 1,
    updated_at = now()
  WHERE conversation_id = NEW.conversation_id
    AND (
      (NEW.sender_profile_id IS NOT NULL AND profile_id != NEW.sender_profile_id)
      OR (NEW.sender_profile_id IS NULL AND profile_id IS NOT NULL)
    );
  
  -- Also increment for customer participants if sender is a profile
  IF NEW.sender_profile_id IS NOT NULL THEN
    UPDATE public.conversation_participants
    SET 
      unread_count = unread_count + 1,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND customer_account_id IS NOT NULL;
  END IF;
  
  -- Handle mentions - increment unread_mention_count
  IF NEW.mentions IS NOT NULL AND jsonb_array_length(NEW.mentions) > 0 THEN
    UPDATE public.conversation_participants
    SET 
      unread_mention_count = unread_mention_count + 1,
      updated_at = now()
    WHERE conversation_id = NEW.conversation_id
      AND profile_id = ANY(
        SELECT (jsonb_array_elements(NEW.mentions)->>'profile_id')::uuid
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_increment_unread_counts
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_unread_counts();

-- Trigger: Log conversation creation activity
CREATE OR REPLACE FUNCTION public.log_conversation_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.conversation_activities (
    conversation_id,
    activity_type,
    actor_id,
    actor_name,
    new_value
  )
  SELECT 
    NEW.id,
    'created'::conversation_activity_type,
    NEW.created_by,
    p.first_name || ' ' || p.last_name,
    jsonb_build_object('type', NEW.type, 'title', NEW.title)
  FROM public.profiles p
  WHERE p.id = NEW.created_by;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_conversation_created
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_conversation_created();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can view conversations they participate in
CREATE POLICY "Users can view participated conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Conversations: Users can create conversations for their business
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = business_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Conversations: Participants can update conversations
CREATE POLICY "Participants can update conversations"
  ON public.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Participants: Users can view participants of their conversations
CREATE POLICY "Users can view conversation participants"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants my_cp
      WHERE my_cp.conversation_id = conversation_id
        AND my_cp.profile_id = auth.uid()
        AND my_cp.left_at IS NULL
    )
  );

-- Participants: Users can add participants to conversations they're in
CREATE POLICY "Users can add participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
    OR (profile_id = auth.uid())
  );

-- Participants: Users can update their own participation
CREATE POLICY "Users can update own participation"
  ON public.conversation_participants FOR UPDATE
  USING (profile_id = auth.uid());

-- Messages: Users can view messages in their conversations
CREATE POLICY "Users can view conversation messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Messages: Users can send messages to their conversations
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Messages: Users can edit their own messages within 15 minutes
CREATE POLICY "Users can edit own messages within window"
  ON public.messages FOR UPDATE
  USING (
    sender_profile_id = auth.uid()
    AND created_at > now() - interval '15 minutes'
    AND is_deleted = false
  );

-- Activities: Users can view activities of their conversations
CREATE POLICY "Users can view conversation activities"
  ON public.conversation_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Activities: System can insert activities (via trigger)
CREATE POLICY "System can insert activities"
  ON public.conversation_activities FOR INSERT
  WITH CHECK (true);

-- Read receipts: Users can view read receipts in their conversations
CREATE POLICY "Users can view read receipts"
  ON public.message_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
      WHERE m.id = message_id
        AND cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

-- Read receipts: Users can create their own read receipts
CREATE POLICY "Users can create own read receipts"
  ON public.message_read_receipts FOR INSERT
  WITH CHECK (reader_profile_id = auth.uid());

-- =============================================
-- STORAGE BUCKET
-- =============================================

-- Create message-attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage policy: Participants can upload attachments
CREATE POLICY "Participants can upload message attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      JOIN public.conversations c ON c.id = cp.conversation_id
      WHERE cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
        AND (storage.foldername(name))[1] = c.business_id::text
        AND (storage.foldername(name))[3] = cp.conversation_id::text
    )
  );

-- Storage policy: Participants can view attachments
CREATE POLICY "Participants can view message attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      JOIN public.conversations c ON c.id = cp.conversation_id
      WHERE cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
        AND (storage.foldername(name))[1] = c.business_id::text
        AND (storage.foldername(name))[3] = cp.conversation_id::text
    )
  );

-- Storage policy: Participants can delete their own attachments
CREATE POLICY "Participants can delete own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      JOIN public.conversations c ON c.id = cp.conversation_id
      WHERE cp.profile_id = auth.uid()
        AND cp.left_at IS NULL
        AND (storage.foldername(name))[1] = c.business_id::text
        AND (storage.foldername(name))[3] = cp.conversation_id::text
    )
  );

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;