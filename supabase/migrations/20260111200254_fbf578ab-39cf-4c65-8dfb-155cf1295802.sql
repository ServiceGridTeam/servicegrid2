-- Phase 4: Stored Procedures for Checklist Operations
-- Four critical RPCs for checklist management with server-side validation

-- 1. apply_checklist_to_job: Manually apply a template to an existing job
CREATE OR REPLACE FUNCTION apply_checklist_to_job(
  p_job_id uuid,
  p_template_id uuid,
  p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_template checklist_templates%ROWTYPE;
  v_checklist_id uuid;
  v_item jsonb;
  v_total_items integer := 0;
  v_required_photos integer := 0;
  v_item_order integer := 0;
  v_actor_name text;
BEGIN
  -- Lock and validate job
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  IF v_job.checklist_id IS NOT NULL THEN
    RAISE EXCEPTION 'Job already has a checklist assigned';
  END IF;
  
  -- Validate template
  SELECT * INTO v_template 
  FROM checklist_templates 
  WHERE id = p_template_id 
    AND business_id = v_job.business_id
    AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_template.id IS NULL THEN
    RAISE EXCEPTION 'Template not found or deleted: %', p_template_id;
  END IF;
  
  -- Get actor name for logging
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Unknown') INTO v_actor_name
  FROM profiles WHERE id = p_created_by;
  
  -- Create checklist record
  INSERT INTO job_checklists (business_id, job_id, template_id, status)
  VALUES (v_job.business_id, p_job_id, p_template_id, 'pending')
  RETURNING id INTO v_checklist_id;
  
  -- Create items from template JSONB
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_template.items)
  LOOP
    INSERT INTO job_checklist_items (
      job_checklist_id, template_item_id, item_order, label, description,
      photo_required, min_photos, max_photos, category
    ) VALUES (
      v_checklist_id,
      v_item->>'id',
      COALESCE((v_item->>'order')::integer, v_item_order),
      v_item->>'label',
      v_item->>'description',
      COALESCE((v_item->>'photo_required')::boolean, false),
      COALESCE((v_item->>'min_photos')::integer, 0),
      COALESCE((v_item->>'max_photos')::integer, 5),
      v_item->>'category'
    );
    
    v_total_items := v_total_items + 1;
    v_item_order := v_item_order + 1;
    
    IF COALESCE((v_item->>'photo_required')::boolean, false) THEN
      v_required_photos := v_required_photos + GREATEST(COALESCE((v_item->>'min_photos')::integer, 1), 1);
    END IF;
  END LOOP;
  
  -- Update checklist counts
  UPDATE job_checklists
  SET total_items = v_total_items, required_photos = v_required_photos
  WHERE id = v_checklist_id;
  
  -- Update job with checklist reference
  UPDATE jobs
  SET checklist_id = v_checklist_id,
      checklist_status = 'pending',
      checklist_progress = 0,
      updated_at = now()
  WHERE id = p_job_id;
  
  -- Log creation event
  INSERT INTO checklist_events (job_checklist_id, business_id, event_type, actor_id, actor_name, metadata)
  VALUES (v_checklist_id, v_job.business_id, 'created', p_created_by, v_actor_name,
    jsonb_build_object('template_id', p_template_id, 'template_name', v_template.name, 
      'auto_applied', false, 'total_items', v_total_items, 'required_photos', v_required_photos));
  
  RETURN v_checklist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. complete_checklist: Mark checklist as completed with validation
CREATE OR REPLACE FUNCTION complete_checklist(
  p_checklist_id uuid,
  p_completed_by uuid
)
RETURNS boolean AS $$
DECLARE
  v_checklist job_checklists%ROWTYPE;
  v_template checklist_templates%ROWTYPE;
  v_unchecked_count integer;
  v_missing_photos integer;
  v_actor_name text;
BEGIN
  -- Lock and validate checklist
  SELECT * INTO v_checklist FROM job_checklists WHERE id = p_checklist_id FOR UPDATE;
  IF v_checklist.id IS NULL THEN
    RAISE EXCEPTION 'Checklist not found: %', p_checklist_id;
  END IF;
  
  IF v_checklist.status IN ('completed', 'waived') THEN
    RAISE EXCEPTION 'Checklist already % at %', v_checklist.status, 
      COALESCE(v_checklist.completed_at, v_checklist.waived_at);
  END IF;
  
  -- Check all items are completed
  SELECT COUNT(*) INTO v_unchecked_count
  FROM job_checklist_items
  WHERE job_checklist_id = p_checklist_id AND checked = false;
  
  IF v_unchecked_count > 0 THEN
    RAISE EXCEPTION 'Cannot complete: % items not checked', v_unchecked_count;
  END IF;
  
  -- Check required photos if template requires it
  SELECT * INTO v_template FROM checklist_templates WHERE id = v_checklist.template_id;
  IF v_template.require_all_photos THEN
    SELECT COUNT(*) INTO v_missing_photos
    FROM job_checklist_items
    WHERE job_checklist_id = p_checklist_id 
      AND photo_required = true
      AND photo_count < min_photos;
    
    IF v_missing_photos > 0 THEN
      RAISE EXCEPTION 'Cannot complete: % items missing required photos', v_missing_photos;
    END IF;
  END IF;
  
  -- Get actor name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Unknown') INTO v_actor_name
  FROM profiles WHERE id = p_completed_by;
  
  -- Update checklist status
  UPDATE job_checklists
  SET status = 'completed',
      completed_at = now(),
      completed_by = p_completed_by,
      completed_items = v_checklist.total_items,
      updated_at = now()
  WHERE id = p_checklist_id;
  
  -- Update job status
  UPDATE jobs
  SET checklist_status = 'completed',
      checklist_progress = 100,
      updated_at = now()
  WHERE checklist_id = p_checklist_id;
  
  -- Log completion event
  INSERT INTO checklist_events (job_checklist_id, business_id, event_type, actor_id, actor_name, metadata)
  VALUES (p_checklist_id, v_checklist.business_id, 'completed', p_completed_by, v_actor_name,
    jsonb_build_object('total_items', v_checklist.total_items, 'total_photos', v_checklist.total_photos));
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. waive_checklist: Skip checklist with required reason
CREATE OR REPLACE FUNCTION waive_checklist(
  p_checklist_id uuid,
  p_reason text,
  p_waived_by uuid
)
RETURNS boolean AS $$
DECLARE
  v_checklist job_checklists%ROWTYPE;
  v_actor_name text;
BEGIN
  -- Validate reason length
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Waive reason must be at least 10 characters';
  END IF;
  
  IF length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Waive reason cannot exceed 500 characters';
  END IF;
  
  -- Lock and validate checklist
  SELECT * INTO v_checklist FROM job_checklists WHERE id = p_checklist_id FOR UPDATE;
  IF v_checklist.id IS NULL THEN
    RAISE EXCEPTION 'Checklist not found: %', p_checklist_id;
  END IF;
  
  IF v_checklist.status IN ('completed', 'waived') THEN
    RAISE EXCEPTION 'Checklist already % at %', v_checklist.status,
      COALESCE(v_checklist.completed_at, v_checklist.waived_at);
  END IF;
  
  -- Get actor name
  SELECT COALESCE(first_name || ' ' || last_name, email, 'Unknown') INTO v_actor_name
  FROM profiles WHERE id = p_waived_by;
  
  -- Update checklist status
  UPDATE job_checklists
  SET status = 'waived',
      waived_at = now(),
      waived_by = p_waived_by,
      waive_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_checklist_id;
  
  -- Update job status
  UPDATE jobs
  SET checklist_status = 'waived',
      updated_at = now()
  WHERE checklist_id = p_checklist_id;
  
  -- Log waive event (truncate reason for privacy in audit log)
  INSERT INTO checklist_events (job_checklist_id, business_id, event_type, actor_id, actor_name, metadata)
  VALUES (p_checklist_id, v_checklist.business_id, 'waived', p_waived_by, v_actor_name,
    jsonb_build_object('reason_preview', left(trim(p_reason), 50), 
      'completed_items', v_checklist.completed_items, 'total_items', v_checklist.total_items));
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. portal_get_checklist: Secure read for customer portal
CREATE OR REPLACE FUNCTION portal_get_checklist(
  p_job_id uuid,
  p_customer_id uuid,
  p_business_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_checklist job_checklists%ROWTYPE;
  v_items jsonb;
BEGIN
  -- Validate job belongs to customer and business
  SELECT * INTO v_job 
  FROM jobs 
  WHERE id = p_job_id 
    AND customer_id = p_customer_id 
    AND business_id = p_business_id;
  
  IF v_job.id IS NULL THEN
    RETURN NULL; -- Unauthorized or not found
  END IF;
  
  IF v_job.checklist_id IS NULL THEN
    RETURN NULL; -- No checklist
  END IF;
  
  -- Get checklist
  SELECT * INTO v_checklist FROM job_checklists WHERE id = v_job.checklist_id;
  
  -- Build sanitized items array (only showing completion status, not internal notes)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'label', i.label,
      'category', i.category,
      'checked', i.checked,
      'checked_at', i.checked_at,
      'checked_by_name', i.checked_by_name,
      'photo_required', i.photo_required,
      'photo_count', i.photo_count,
      'photo_urls', i.photo_urls
    ) ORDER BY i.item_order
  ) INTO v_items
  FROM job_checklist_items i
  WHERE i.job_checklist_id = v_checklist.id;
  
  RETURN jsonb_build_object(
    'id', v_checklist.id,
    'status', v_checklist.status,
    'total_items', v_checklist.total_items,
    'completed_items', v_checklist.completed_items,
    'completed_at', v_checklist.completed_at,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add comments for documentation
COMMENT ON FUNCTION apply_checklist_to_job(uuid, uuid, uuid) IS 'Manually apply a checklist template to an existing job';
COMMENT ON FUNCTION complete_checklist(uuid, uuid) IS 'Mark a checklist as completed after validating all items are checked';
COMMENT ON FUNCTION waive_checklist(uuid, text, uuid) IS 'Skip/waive a checklist with a required documented reason (10-500 chars)';
COMMENT ON FUNCTION portal_get_checklist(uuid, uuid, uuid) IS 'Secure read of checklist data for customer portal viewing';