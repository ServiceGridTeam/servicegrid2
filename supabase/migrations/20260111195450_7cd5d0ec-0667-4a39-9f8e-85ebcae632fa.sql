-- Phase 3: Auto-Apply Checklist Trigger
-- Automatically applies matching checklist templates when jobs are created

-- Function to auto-apply checklist template on job creation
CREATE OR REPLACE FUNCTION auto_apply_checklist()
RETURNS TRIGGER AS $$
DECLARE
  v_template checklist_templates%ROWTYPE;
  v_checklist_id uuid;
  v_item jsonb;
  v_total_items integer := 0;
  v_required_photos integer := 0;
  v_item_order integer := 0;
BEGIN
  -- Skip if job already has a checklist
  IF NEW.checklist_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find matching template (prefer specific job_type over catch-all)
  SELECT * INTO v_template
  FROM checklist_templates
  WHERE business_id = NEW.business_id
    AND is_active = true
    AND auto_apply = true
    AND deleted_at IS NULL
    AND (job_type IS NULL OR job_type = NEW.service_type)
  ORDER BY job_type NULLS LAST
  LIMIT 1;
  
  -- No matching template, return unchanged
  IF v_template.id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Create checklist record
  INSERT INTO job_checklists (business_id, job_id, template_id, status)
  VALUES (NEW.business_id, NEW.id, v_template.id, 'pending')
  RETURNING id INTO v_checklist_id;
  
  -- Create items from template JSONB array
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_template.items)
  LOOP
    INSERT INTO job_checklist_items (
      job_checklist_id, 
      template_item_id, 
      item_order, 
      label, 
      description,
      photo_required, 
      min_photos, 
      max_photos, 
      category
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
    
    -- Count required photos
    IF COALESCE((v_item->>'photo_required')::boolean, false) THEN
      v_required_photos := v_required_photos + GREATEST(COALESCE((v_item->>'min_photos')::integer, 1), 1);
    END IF;
  END LOOP;
  
  -- Update checklist with calculated counts
  UPDATE job_checklists
  SET total_items = v_total_items, 
      required_photos = v_required_photos
  WHERE id = v_checklist_id;
  
  -- Set job's checklist reference (will be applied since this is BEFORE INSERT)
  NEW.checklist_id := v_checklist_id;
  NEW.checklist_status := 'pending';
  NEW.checklist_progress := 0;
  
  -- Log creation event
  INSERT INTO checklist_events (
    job_checklist_id, 
    business_id, 
    event_type, 
    actor_name, 
    metadata
  )
  VALUES (
    v_checklist_id, 
    NEW.business_id, 
    'created', 
    'System', 
    jsonb_build_object(
      'template_id', v_template.id, 
      'template_name', v_template.name, 
      'auto_applied', true,
      'total_items', v_total_items,
      'required_photos', v_required_photos
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on jobs table
CREATE TRIGGER auto_apply_checklist_on_job_create
  BEFORE INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.checklist_id IS NULL)
  EXECUTE FUNCTION auto_apply_checklist();

-- Add comment for documentation
COMMENT ON FUNCTION auto_apply_checklist() IS 'Automatically applies matching checklist templates to new jobs based on service_type and auto_apply settings';