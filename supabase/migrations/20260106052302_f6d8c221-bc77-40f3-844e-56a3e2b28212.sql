-- Create a function that calls the trigger-sequence-enrollment edge function
CREATE OR REPLACE FUNCTION public.trigger_sequence_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _trigger_type TEXT;
  _customer_id UUID;
  _business_id UUID;
BEGIN
  -- Determine trigger type and customer based on the table
  CASE TG_TABLE_NAME
    WHEN 'customers' THEN
      _trigger_type := 'customer_created';
      _customer_id := NEW.id;
      _business_id := NEW.business_id;
    WHEN 'quotes' THEN
      IF TG_OP = 'UPDATE' AND OLD.status != 'sent' AND NEW.status = 'sent' THEN
        _trigger_type := 'quote_sent';
      ELSIF TG_OP = 'UPDATE' AND OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
        _trigger_type := 'quote_accepted';
      ELSE
        RETURN NEW;
      END IF;
      _customer_id := NEW.customer_id;
      _business_id := NEW.business_id;
    WHEN 'jobs' THEN
      IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
        _trigger_type := 'job_completed';
        _customer_id := NEW.customer_id;
        _business_id := NEW.business_id;
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'invoices' THEN
      IF TG_OP = 'UPDATE' AND OLD.status != 'paid' AND NEW.status = 'paid' THEN
        _trigger_type := 'invoice_paid';
        _customer_id := NEW.customer_id;
        _business_id := NEW.business_id;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
  END CASE;

  -- Skip if no customer
  IF _customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert into a queue table for async processing
  INSERT INTO public.sequence_enrollment_queue (
    trigger_type,
    customer_id,
    business_id,
    source_table,
    source_id,
    created_at
  ) VALUES (
    _trigger_type,
    _customer_id,
    _business_id,
    TG_TABLE_NAME,
    NEW.id,
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Create queue table for async enrollment processing
CREATE TABLE IF NOT EXISTS public.sequence_enrollment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sequence_enrollment_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy - only service role can access
CREATE POLICY "Service role access only" ON public.sequence_enrollment_queue
  FOR ALL USING (false);

-- Create index for processing queue
CREATE INDEX IF NOT EXISTS idx_sequence_enrollment_queue_unprocessed 
  ON public.sequence_enrollment_queue (created_at) 
  WHERE processed_at IS NULL;

-- Create triggers on relevant tables
DROP TRIGGER IF EXISTS trigger_sequence_enrollment_customers ON public.customers;
CREATE TRIGGER trigger_sequence_enrollment_customers
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sequence_enrollment();

DROP TRIGGER IF EXISTS trigger_sequence_enrollment_quotes ON public.quotes;
CREATE TRIGGER trigger_sequence_enrollment_quotes
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sequence_enrollment();

DROP TRIGGER IF EXISTS trigger_sequence_enrollment_jobs ON public.jobs;
CREATE TRIGGER trigger_sequence_enrollment_jobs
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sequence_enrollment();

DROP TRIGGER IF EXISTS trigger_sequence_enrollment_invoices ON public.invoices;
CREATE TRIGGER trigger_sequence_enrollment_invoices
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sequence_enrollment();