-- Create comparison audit trigger function
CREATE OR REPLACE FUNCTION public.log_comparison_audit() RETURNS TRIGGER AS $$
DECLARE
  v_actor_name text;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, email) INTO v_actor_name 
  FROM public.profiles WHERE id = auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.annotation_audit_log (business_id, comparison_id, action, target_type, actor_id, actor_name)
    VALUES (NEW.business_id, NEW.id, 'create', 'comparison', NEW.created_by, v_actor_name);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.share_token IS NOT NULL AND OLD.share_token IS NULL THEN
      INSERT INTO public.annotation_audit_log (business_id, comparison_id, action, target_type, actor_id, actor_name)
      VALUES (NEW.business_id, NEW.id, 'share', 'comparison', COALESCE(auth.uid(), NEW.created_by), v_actor_name);
    ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      INSERT INTO public.annotation_audit_log (business_id, comparison_id, action, target_type, actor_id, actor_name)
      VALUES (NEW.business_id, NEW.id, 'delete', 'comparison', COALESCE(auth.uid(), NEW.created_by), v_actor_name);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for comparison audit
CREATE TRIGGER audit_comparisons
AFTER INSERT OR UPDATE ON public.before_after_comparisons
FOR EACH ROW EXECUTE FUNCTION public.log_comparison_audit();