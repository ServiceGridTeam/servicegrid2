-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create businesses" ON public.businesses;

-- Create a PERMISSIVE INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create businesses" 
ON public.businesses
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also ensure user_roles allows users to insert their own owner role during onboarding
DROP POLICY IF EXISTS "Users can insert their own owner role" ON public.user_roles;

CREATE POLICY "Users can insert their own owner role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());