-- Create atomic function for business setup during onboarding
-- This handles all 3 operations in a single transaction:
-- 1. Create business
-- 2. Update profile with business_id and is_onboarded
-- 3. Create owner role

CREATE OR REPLACE FUNCTION public.setup_business_for_user(
  _name TEXT,
  _industry TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _business_id UUID;
  _user_id UUID;
BEGIN
  -- Get the authenticated user
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a business
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND business_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a business';
  END IF;

  -- Step 1: Create the business
  INSERT INTO businesses (name, industry, phone, email)
  VALUES (_name, _industry, _phone, _email)
  RETURNING id INTO _business_id;

  -- Step 2: Link profile to business and mark as onboarded
  UPDATE profiles
  SET business_id = _business_id, is_onboarded = true, updated_at = now()
  WHERE id = _user_id;

  -- Step 3: Create the owner role
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'owner');

  -- Return the business ID
  RETURN _business_id;
END;
$$;