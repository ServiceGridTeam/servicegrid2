
-- Fix search_path on functions created in previous migration

CREATE OR REPLACE FUNCTION public.get_customer_account_businesses(account_id UUID)
RETURNS TABLE(business_id UUID, customer_id UUID, is_primary BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT cal.business_id, cal.customer_id, cal.is_primary
  FROM public.customer_account_links cal
  WHERE cal.customer_account_id = account_id
    AND cal.status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_service_request_number(bus_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(request_number, '[^0-9]', '', 'g'), '')::INTEGER), 0) + 1
  INTO next_num
  FROM public.customer_service_requests
  WHERE business_id = bus_id;
  
  result := 'SR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_service_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := generate_service_request_number(NEW.business_id);
  END IF;
  RETURN NEW;
END;
$$;
