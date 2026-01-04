-- Create team_invites table for managing team member invitations
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'technician',
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, email)
);

-- Create index on token for fast lookups
CREATE INDEX idx_team_invites_token ON public.team_invites(token);

-- Create index on business_id for listing invites
CREATE INDEX idx_team_invites_business_id ON public.team_invites(business_id);

-- Enable Row Level Security
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Only owners/admins can manage invites for their business
CREATE POLICY "Owners/admins can manage invites"
ON public.team_invites FOR ALL
USING (
  user_belongs_to_business(business_id) AND 
  (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Anyone can view invite by token (needed for acceptance flow)
CREATE POLICY "Anyone can view invite by token"
ON public.team_invites FOR SELECT
USING (token IS NOT NULL);

-- Create function to accept an invite (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_id UUID;
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
    -- Delete expired invite
    DELETE FROM team_invites WHERE id = _invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;
  
  -- Check if user already belongs to a business
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id AND business_id IS NOT NULL) THEN
    RAISE EXCEPTION 'User already belongs to a business';
  END IF;
  
  -- Link user to business
  UPDATE profiles
  SET business_id = _invite.business_id, updated_at = now()
  WHERE id = _user_id;
  
  -- Assign the role
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Delete the invite
  DELETE FROM team_invites WHERE id = _invite.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'business_id', _invite.business_id,
    'role', _invite.role
  );
END;
$$;