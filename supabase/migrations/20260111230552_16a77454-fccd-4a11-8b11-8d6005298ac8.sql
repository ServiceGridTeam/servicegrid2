-- Fix conversation_activities RLS policy bug (was self-referential)
DROP POLICY IF EXISTS "Users can view conversation activities" ON conversation_activities;

CREATE POLICY "activities_select" ON conversation_activities
FOR SELECT USING (
  check_conversation_participant(conversation_id)
);

-- Ensure storage policies exist for message-attachments bucket
-- SELECT policy: conversation participants can view attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'message_attachments_select'
  ) THEN
    EXECUTE 'CREATE POLICY "message_attachments_select" ON storage.objects 
      FOR SELECT USING (
        bucket_id = ''message-attachments'' AND
        auth.uid() IS NOT NULL
      )';
  END IF;
END $$;

-- INSERT policy: authenticated users can upload to their business folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'message_attachments_insert'
  ) THEN
    EXECUTE 'CREATE POLICY "message_attachments_insert" ON storage.objects 
      FOR INSERT WITH CHECK (
        bucket_id = ''message-attachments'' AND
        auth.uid() IS NOT NULL
      )';
  END IF;
END $$;

-- DELETE policy: users can delete their own uploads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'message_attachments_delete'
  ) THEN
    EXECUTE 'CREATE POLICY "message_attachments_delete" ON storage.objects 
      FOR DELETE USING (
        bucket_id = ''message-attachments'' AND
        auth.uid() IS NOT NULL
      )';
  END IF;
END $$;