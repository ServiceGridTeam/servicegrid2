-- Create RPC function for atomic view count increment
CREATE OR REPLACE FUNCTION public.increment_gallery_views_atomic(p_share_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE photo_gallery_shares
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_share_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_gallery_views_atomic(UUID) TO anon, authenticated, service_role;