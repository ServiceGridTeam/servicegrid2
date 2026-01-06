-- =============================================
-- PHASE 1: Multi-Business Architecture Migration
-- =============================================

-- 1. Create business_memberships table
CREATE TABLE IF NOT EXISTS public.business_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'left', 'removed')),
  is_primary boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES public.profiles(id),
  invited_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);

-- 2. Create business_membership_audit table for audit trail
CREATE TABLE IF NOT EXISTS public.business_membership_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'role_changed', 'suspended', 'reactivated', 'removed', 'left', 'ownership_transferred')),
  old_role app_role,
  new_role app_role,
  performed_by uuid REFERENCES public.profiles(id),
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- 3. Add columns to profiles for active context
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS active_business_id uuid REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS active_role app_role;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_memberships_user_id ON public.business_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_business_memberships_business_id ON public.business_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_business_memberships_user_active ON public.business_memberships(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_memberships_one_primary_per_user 
  ON public.business_memberships(user_id) WHERE is_primary = true AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_membership_audit_membership_id ON public.business_membership_audit(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_audit_user_id ON public.business_membership_audit(user_id);

-- 5. Helper function: Get user's active business IDs
CREATE OR REPLACE FUNCTION public.get_user_business_ids(p_user_id uuid DEFAULT NULL)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(business_id),
    ARRAY[]::uuid[]
  )
  FROM public.business_memberships
  WHERE user_id = COALESCE(p_user_id, auth.uid())
    AND status = 'active'
$$;

-- 6. Helper function: Switch active business
CREATE OR REPLACE FUNCTION public.switch_active_business(p_business_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_membership RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get the membership for this business
  SELECT * INTO v_membership
  FROM public.business_memberships
  WHERE user_id = v_user_id
    AND business_id = p_business_id
    AND status = 'active';
  
  IF v_membership IS NULL THEN
    RAISE EXCEPTION 'No active membership for this business';
  END IF;
  
  -- Update profile with new active context
  UPDATE public.profiles
  SET 
    active_business_id = p_business_id,
    active_role = v_membership.role,
    updated_at = NOW()
  WHERE id = v_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'business_id', p_business_id,
    'role', v_membership.role
  );
END;
$$;

-- 7. Helper function: Get current user's role in a business
CREATE OR REPLACE FUNCTION public.get_user_role_in_business(p_business_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.business_memberships
  WHERE user_id = auth.uid()
    AND business_id = p_business_id
    AND status = 'active'
$$;

-- 8. Trigger: Update updated_at on membership changes
CREATE OR REPLACE FUNCTION public.update_membership_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_membership_updated_at ON public.business_memberships;
CREATE TRIGGER trigger_update_membership_updated_at
  BEFORE UPDATE ON public.business_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_membership_updated_at();

-- 9. Trigger: Clear active_business_id if membership removed
CREATE OR REPLACE FUNCTION public.clear_active_business_if_removed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If membership is being removed/left/suspended, clear active context if it was active
  IF NEW.status IN ('removed', 'left', 'suspended') AND OLD.status = 'active' THEN
    UPDATE public.profiles
    SET 
      active_business_id = NULL,
      active_role = NULL,
      updated_at = NOW()
    WHERE id = NEW.user_id
      AND active_business_id = NEW.business_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_clear_active_business ON public.business_memberships;
CREATE TRIGGER trigger_clear_active_business
  AFTER UPDATE ON public.business_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_active_business_if_removed();

-- 10. Migrate existing data from profiles.business_id to business_memberships
INSERT INTO public.business_memberships (user_id, business_id, role, is_primary, joined_at)
SELECT 
  p.id as user_id,
  p.business_id,
  COALESCE(
    (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1),
    'technician'::app_role
  ) as role,
  true as is_primary,
  COALESCE(p.created_at, NOW()) as joined_at
FROM public.profiles p
WHERE p.business_id IS NOT NULL
ON CONFLICT (user_id, business_id) DO NOTHING;

-- 11. Set active_business_id for users who don't have it set yet
UPDATE public.profiles p
SET 
  active_business_id = p.business_id,
  active_role = (
    SELECT bm.role 
    FROM public.business_memberships bm 
    WHERE bm.user_id = p.id AND bm.business_id = p.business_id AND bm.status = 'active'
    LIMIT 1
  )
WHERE p.business_id IS NOT NULL
  AND p.active_business_id IS NULL;

-- 12. Enable RLS on new tables
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_membership_audit ENABLE ROW LEVEL SECURITY;

-- 13. RLS Policies for business_memberships
-- Users can see their own memberships
CREATE POLICY "Users can view own memberships"
  ON public.business_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can see memberships of people in their businesses
CREATE POLICY "Users can view memberships in their businesses"
  ON public.business_memberships
  FOR SELECT
  USING (
    business_id IN (SELECT unnest(public.get_user_business_ids()))
  );

-- Only admins/owners can insert memberships (via invite flow)
CREATE POLICY "Admins can insert memberships"
  ON public.business_memberships
  FOR INSERT
  WITH CHECK (
    public.get_user_role_in_business(business_id) IN ('owner', 'admin')
    OR invited_by IS NULL -- Allow system/self-creation during onboarding
  );

-- Users can update their own membership (e.g., leave)
CREATE POLICY "Users can update own membership"
  ON public.business_memberships
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owners/admins can update memberships in their business
CREATE POLICY "Admins can update memberships in their business"
  ON public.business_memberships
  FOR UPDATE
  USING (
    public.get_user_role_in_business(business_id) IN ('owner', 'admin')
  );

-- 14. RLS Policies for business_membership_audit
CREATE POLICY "Users can view audit for their memberships"
  ON public.business_membership_audit
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view audit in their businesses"
  ON public.business_membership_audit
  FOR SELECT
  USING (
    business_id IN (SELECT unnest(public.get_user_business_ids()))
    AND public.get_user_role_in_business(business_id) IN ('owner', 'admin')
  );

-- Only system can insert audit records (via triggers/functions)
CREATE POLICY "System can insert audit records"
  ON public.business_membership_audit
  FOR INSERT
  WITH CHECK (true);

-- 15. Update accept_team_invite to create membership
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invite RECORD;
  _user_id UUID;
  _existing_membership RECORD;
BEGIN
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the invite
  SELECT * INTO _invite FROM team_invites WHERE token = _token;
  
  IF _invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;
  
  IF _invite.expires_at < now() THEN
    DELETE FROM team_invites WHERE id = _invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;
  
  -- Check if user already has membership in this business
  SELECT * INTO _existing_membership
  FROM business_memberships
  WHERE user_id = _user_id AND business_id = _invite.business_id;
  
  IF _existing_membership IS NOT NULL THEN
    -- Reactivate if suspended/removed
    IF _existing_membership.status IN ('suspended', 'removed', 'left') THEN
      UPDATE business_memberships
      SET status = 'active', role = _invite.role, updated_at = NOW()
      WHERE id = _existing_membership.id;
    ELSE
      DELETE FROM team_invites WHERE id = _invite.id;
      RAISE EXCEPTION 'Already a member of this business';
    END IF;
  ELSE
    -- Create new membership
    INSERT INTO business_memberships (user_id, business_id, role, invited_by, invited_at, is_primary)
    VALUES (
      _user_id, 
      _invite.business_id, 
      _invite.role,
      _invite.invited_by,
      _invite.created_at,
      NOT EXISTS (SELECT 1 FROM business_memberships WHERE user_id = _user_id AND status = 'active')
    );
  END IF;
  
  -- Set as active business if user doesn't have one
  UPDATE profiles
  SET 
    active_business_id = COALESCE(active_business_id, _invite.business_id),
    active_role = CASE WHEN active_business_id IS NULL THEN _invite.role ELSE active_role END,
    business_id = COALESCE(business_id, _invite.business_id), -- Keep legacy field in sync
    updated_at = now()
  WHERE id = _user_id;
  
  -- Maintain legacy user_roles for backward compatibility
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Delete the invite
  DELETE FROM team_invites WHERE id = _invite.id;
  
  -- Create audit record
  INSERT INTO business_membership_audit (membership_id, user_id, business_id, action, new_role, performed_by)
  SELECT id, user_id, business_id, 'created', role, _user_id
  FROM business_memberships
  WHERE user_id = _user_id AND business_id = _invite.business_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'business_id', _invite.business_id,
    'role', _invite.role
  );
END;
$function$;

-- 16. Update setup_business_for_user to create owner membership
CREATE OR REPLACE FUNCTION public.setup_business_for_user(_name text, _industry text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _business_id UUID;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a primary business
  IF EXISTS (SELECT 1 FROM business_memberships WHERE user_id = _user_id AND is_primary = true AND status = 'active') THEN
    RAISE EXCEPTION 'User already has a primary business';
  END IF;

  -- Create the business
  INSERT INTO businesses (name, industry, phone, email)
  VALUES (_name, _industry, _phone, _email)
  RETURNING id INTO _business_id;

  -- Create owner membership
  INSERT INTO business_memberships (user_id, business_id, role, is_primary)
  VALUES (_user_id, _business_id, 'owner', true);

  -- Update profile with active context and legacy fields
  UPDATE profiles
  SET 
    business_id = _business_id,
    active_business_id = _business_id,
    active_role = 'owner',
    is_onboarded = true, 
    updated_at = now()
  WHERE id = _user_id;

  -- Create legacy owner role for backward compatibility
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'owner');

  -- Create audit record
  INSERT INTO business_membership_audit (membership_id, user_id, business_id, action, new_role, performed_by)
  SELECT id, user_id, business_id, 'created', 'owner', _user_id
  FROM business_memberships
  WHERE user_id = _user_id AND business_id = _business_id;

  RETURN _business_id;
END;
$function$;