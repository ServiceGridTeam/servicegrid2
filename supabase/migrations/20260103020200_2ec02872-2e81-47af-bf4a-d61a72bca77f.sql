-- Add public_token, view_count, sent_at to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS public_token uuid UNIQUE DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone;

-- Add public_token to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS public_token uuid UNIQUE DEFAULT gen_random_uuid();

-- Create index for public token lookups
CREATE INDEX IF NOT EXISTS idx_quotes_public_token ON public.quotes(public_token);
CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON public.invoices(public_token);

-- Allow anonymous access to quotes via public_token for customer viewing
CREATE POLICY "Anyone can view quotes via public_token" 
ON public.quotes 
FOR SELECT 
TO anon
USING (public_token IS NOT NULL);

-- Allow anonymous access to quote_items for quotes accessible via public_token
CREATE POLICY "Anyone can view quote items for public quotes" 
ON public.quote_items 
FOR SELECT 
TO anon
USING (EXISTS (
  SELECT 1 FROM quotes q 
  WHERE q.id = quote_items.quote_id 
  AND q.public_token IS NOT NULL
));

-- Allow anonymous access to invoices via public_token for customer viewing
CREATE POLICY "Anyone can view invoices via public_token" 
ON public.invoices 
FOR SELECT 
TO anon
USING (public_token IS NOT NULL);

-- Allow anonymous access to invoice_items for invoices accessible via public_token
CREATE POLICY "Anyone can view invoice items for public invoices" 
ON public.invoice_items 
FOR SELECT 
TO anon
USING (EXISTS (
  SELECT 1 FROM invoices i 
  WHERE i.id = invoice_items.invoice_id 
  AND i.public_token IS NOT NULL
));

-- Allow anonymous access to customer info for quotes/invoices (limited fields)
CREATE POLICY "Anyone can view customer name for public quotes/invoices" 
ON public.customers 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM quotes q WHERE q.customer_id = customers.id AND q.public_token IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM invoices i WHERE i.customer_id = customers.id AND i.public_token IS NOT NULL
  )
);

-- Allow anonymous access to business info for branding on public pages
CREATE POLICY "Anyone can view business info for public pages" 
ON public.businesses 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM quotes q WHERE q.business_id = businesses.id AND q.public_token IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM invoices i WHERE i.business_id = businesses.id AND i.public_token IS NOT NULL
  )
);

-- Allow anonymous users to update quotes (for approval/decline actions)
CREATE POLICY "Anyone can update quotes via public_token" 
ON public.quotes 
FOR UPDATE 
TO anon
USING (public_token IS NOT NULL)
WITH CHECK (public_token IS NOT NULL);