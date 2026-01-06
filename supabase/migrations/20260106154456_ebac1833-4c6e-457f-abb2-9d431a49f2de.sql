-- Enable realtime for portal-relevant tables that are not already added
-- Note: jobs may already be in the publication, so we use a DO block to handle this safely
DO $$
BEGIN
  -- Try to add quotes table
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already exists, ignore
  END;
  
  -- Try to add invoices table
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already exists, ignore
  END;
  
  -- Try to add customer_service_requests table
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_service_requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already exists, ignore
  END;
END $$;