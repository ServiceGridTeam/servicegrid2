-- Create storage bucket for rendered annotations
INSERT INTO storage.buckets (id, name, public)
VALUES ('rendered-annotations', 'rendered-annotations', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for rendered annotations bucket
CREATE POLICY "Anyone can view rendered annotations"
ON storage.objects FOR SELECT
USING (bucket_id = 'rendered-annotations');

CREATE POLICY "Service role can upload rendered annotations"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'rendered-annotations');

CREATE POLICY "Service role can update rendered annotations"
ON storage.objects FOR UPDATE
USING (bucket_id = 'rendered-annotations');

CREATE POLICY "Service role can delete rendered annotations"
ON storage.objects FOR DELETE
USING (bucket_id = 'rendered-annotations');

-- Audit log trigger for annotation changes
CREATE OR REPLACE FUNCTION public.log_annotation_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.annotation_audit_log (business_id, annotation_id, action, actor_id, target_type)
    VALUES (NEW.business_id, NEW.id, 'create', NEW.created_by, 'annotation');
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log if meaningful changes occurred
    IF OLD.annotation_data IS DISTINCT FROM NEW.annotation_data OR 
       OLD.is_current IS DISTINCT FROM NEW.is_current OR
       OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
      INSERT INTO public.annotation_audit_log (business_id, annotation_id, action, actor_id, target_type, changes)
      VALUES (
        NEW.business_id, 
        NEW.id, 
        CASE 
          WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'delete'
          WHEN OLD.is_current = false AND NEW.is_current = true THEN 'restore'
          ELSE 'update'
        END,
        auth.uid(), 
        'annotation',
        jsonb_build_object(
          'object_count', jsonb_build_object('old', OLD.object_count, 'new', NEW.object_count),
          'is_current', jsonb_build_object('old', OLD.is_current, 'new', NEW.is_current)
        )
      );
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS audit_annotations ON public.media_annotations;
CREATE TRIGGER audit_annotations
AFTER INSERT OR UPDATE ON public.media_annotations
FOR EACH ROW EXECUTE FUNCTION public.log_annotation_audit();

-- pg_cron job to clean up expired annotation locks (every 5 minutes)
SELECT cron.schedule(
  'cleanup-expired-annotation-locks',
  '*/5 * * * *',
  $$DELETE FROM public.annotation_locks WHERE expires_at < NOW()$$
);

-- pg_cron job to process render queue (every 2 minutes)
SELECT cron.schedule(
  'process-render-queue',
  '*/2 * * * *',
  $$SELECT net.http_post(
    url := 'https://wzglfwcftigofbuojeci.supabase.co/functions/v1/process-render-queue',
    headers := '{"Content-Type": "application/json"}'::jsonb
  )$$
);