-- Phase 2: Triggers for Progress Sync & Status Updates
-- Addresses race condition on progress counters (Critical Issue #1)

-- =============================================================================
-- 1. sync_checklist_progress - Atomically update counters when items change
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_checklist_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_completed_count integer;
  v_photo_count integer;
BEGIN
  -- Recalculate from actual data (prevents race conditions)
  SELECT 
    COUNT(*) FILTER (WHERE checked = true),
    COUNT(*) FILTER (WHERE array_length(photo_ids, 1) > 0)
  INTO v_completed_count, v_photo_count
  FROM job_checklist_items
  WHERE job_checklist_id = NEW.job_checklist_id;

  -- Update checklist with atomic values
  UPDATE job_checklists
  SET 
    completed_items = v_completed_count,
    attached_photos = v_photo_count,
    started_at = CASE 
      WHEN started_at IS NULL AND v_completed_count > 0 THEN NOW() 
      ELSE started_at 
    END,
    version = version + 1,
    updated_at = NOW()
  WHERE id = NEW.job_checklist_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on job_checklist_items updates
CREATE TRIGGER trigger_sync_checklist_progress
  AFTER UPDATE ON job_checklist_items
  FOR EACH ROW
  WHEN (OLD.checked IS DISTINCT FROM NEW.checked OR OLD.photo_ids IS DISTINCT FROM NEW.photo_ids)
  EXECUTE FUNCTION sync_checklist_progress();

-- =============================================================================
-- 2. update_checklist_status - Auto-transition status and sync to jobs
-- =============================================================================
CREATE OR REPLACE FUNCTION update_checklist_status()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id uuid;
  v_new_status text;
  v_progress integer;
BEGIN
  -- Get associated job_id
  v_job_id := NEW.job_id;
  v_new_status := NEW.status;
  
  -- Auto-transition from pending to in_progress when first item checked
  IF OLD.status = 'pending' AND NEW.completed_items > 0 AND NEW.status = 'pending' THEN
    v_new_status := 'in_progress';
    
    UPDATE job_checklists
    SET status = 'in_progress'
    WHERE id = NEW.id;
  END IF;

  -- Calculate progress percentage
  IF NEW.total_items = 0 THEN
    v_progress := 0;
  ELSE
    v_progress := ROUND((NEW.completed_items::numeric / NEW.total_items::numeric) * 100);
  END IF;

  -- Sync to jobs table
  UPDATE jobs
  SET 
    checklist_status = v_new_status,
    checklist_progress = v_progress
  WHERE id = v_job_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on job_checklists updates
CREATE TRIGGER trigger_update_checklist_status
  AFTER UPDATE ON job_checklists
  FOR EACH ROW
  WHEN (OLD.completed_items IS DISTINCT FROM NEW.completed_items OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_checklist_status();

-- =============================================================================
-- 3. log_checklist_item_event - Audit trail for item changes
-- =============================================================================
CREATE OR REPLACE FUNCTION log_checklist_item_event()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id uuid;
  v_event_type text;
BEGIN
  -- Get business_id from parent checklist
  SELECT business_id INTO v_business_id
  FROM job_checklists
  WHERE id = NEW.job_checklist_id;

  -- Log check/uncheck events
  IF OLD.checked IS DISTINCT FROM NEW.checked THEN
    v_event_type := CASE WHEN NEW.checked THEN 'item_checked' ELSE 'item_unchecked' END;
    
    INSERT INTO checklist_events (
      job_checklist_id, 
      business_id, 
      event_type, 
      actor_id, 
      actor_name, 
      item_id, 
      item_label,
      metadata
    ) VALUES (
      NEW.job_checklist_id,
      v_business_id,
      v_event_type,
      NEW.checked_by,
      NEW.checked_by_name,
      NEW.id,
      NEW.label,
      jsonb_build_object('checked_at', NEW.checked_at)
    );
  END IF;

  -- Log note additions
  IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL AND NEW.notes != '' THEN
    INSERT INTO checklist_events (
      job_checklist_id,
      business_id,
      event_type,
      actor_id,
      actor_name,
      item_id,
      item_label,
      metadata
    ) VALUES (
      NEW.job_checklist_id,
      v_business_id,
      'note_added',
      NEW.checked_by,
      NEW.checked_by_name,
      NEW.id,
      NEW.label,
      jsonb_build_object('note_length', length(NEW.notes))
    );
  END IF;

  -- Log photo changes
  IF OLD.photo_ids IS DISTINCT FROM NEW.photo_ids THEN
    IF array_length(NEW.photo_ids, 1) > COALESCE(array_length(OLD.photo_ids, 1), 0) THEN
      INSERT INTO checklist_events (
        job_checklist_id,
        business_id,
        event_type,
        actor_id,
        actor_name,
        item_id,
        item_label,
        metadata
      ) VALUES (
        NEW.job_checklist_id,
        v_business_id,
        'photo_attached',
        NEW.checked_by,
        NEW.checked_by_name,
        NEW.id,
        NEW.label,
        jsonb_build_object('photo_count', array_length(NEW.photo_ids, 1))
      );
    ELSIF array_length(NEW.photo_ids, 1) < COALESCE(array_length(OLD.photo_ids, 1), 0) THEN
      INSERT INTO checklist_events (
        job_checklist_id,
        business_id,
        event_type,
        actor_id,
        actor_name,
        item_id,
        item_label,
        metadata
      ) VALUES (
        NEW.job_checklist_id,
        v_business_id,
        'photo_removed',
        NEW.checked_by,
        NEW.checked_by_name,
        NEW.id,
        NEW.label,
        jsonb_build_object('photo_count', array_length(NEW.photo_ids, 1))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on job_checklist_items updates for audit logging
CREATE TRIGGER trigger_log_checklist_item_event
  AFTER UPDATE ON job_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION log_checklist_item_event();

-- =============================================================================
-- 4. sync_job_checklist_link - Link new checklists back to jobs table
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_job_checklist_link()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE jobs
  SET 
    checklist_id = NEW.id,
    checklist_status = NEW.status,
    checklist_progress = 0
  WHERE id = NEW.job_id;

  -- Log creation event
  INSERT INTO checklist_events (
    job_checklist_id,
    business_id,
    event_type,
    metadata
  ) VALUES (
    NEW.id,
    NEW.business_id,
    'created',
    jsonb_build_object(
      'template_id', NEW.template_id,
      'total_items', NEW.total_items,
      'required_photos', NEW.required_photos
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on job_checklists insert
CREATE TRIGGER trigger_sync_job_checklist_link
  AFTER INSERT ON job_checklists
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_checklist_link();