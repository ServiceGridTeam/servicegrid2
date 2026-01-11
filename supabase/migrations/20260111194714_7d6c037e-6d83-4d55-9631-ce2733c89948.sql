-- =====================================================
-- QA Checklists Phase 1: Database Schema + RLS
-- =====================================================

-- 1. CHECKLIST_TEMPLATES TABLE
-- Stores reusable checklist templates for different job types
CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  job_type text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  auto_apply boolean NOT NULL DEFAULT false,
  require_all_photos boolean NOT NULL DEFAULT false,
  allow_notes boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id)
);

-- Indexes for checklist_templates
CREATE INDEX idx_checklist_templates_business ON public.checklist_templates(business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_checklist_templates_job_type ON public.checklist_templates(business_id, job_type) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX idx_checklist_templates_auto ON public.checklist_templates(business_id, job_type) WHERE deleted_at IS NULL AND is_active = true AND auto_apply = true;

-- 2. JOB_CHECKLISTS TABLE
-- One record per job with overall checklist status and progress
CREATE TABLE public.job_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.checklist_templates(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'waived')),
  total_items integer NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  completed_items integer NOT NULL DEFAULT 0 CHECK (completed_items >= 0),
  required_photos integer NOT NULL DEFAULT 0 CHECK (required_photos >= 0),
  attached_photos integer NOT NULL DEFAULT 0 CHECK (attached_photos >= 0),
  version integer NOT NULL DEFAULT 1,
  started_at timestamptz,
  completed_at timestamptz,
  waived_at timestamptz,
  waived_by uuid REFERENCES public.profiles(id),
  waive_reason text CHECK (waive_reason IS NULL OR length(waive_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_checklist_per_job UNIQUE (job_id),
  CONSTRAINT completed_lte_total CHECK (completed_items <= total_items),
  CONSTRAINT attached_lte_required CHECK (attached_photos <= required_photos OR required_photos = 0)
);

-- Indexes for job_checklists
CREATE INDEX idx_job_checklists_job ON public.job_checklists(job_id);
CREATE INDEX idx_job_checklists_business ON public.job_checklists(business_id);
CREATE INDEX idx_job_checklists_status ON public.job_checklists(business_id, status);
CREATE INDEX idx_job_checklists_completed ON public.job_checklists(business_id, completed_at DESC) WHERE status = 'completed';
CREATE INDEX idx_job_checklists_pending ON public.job_checklists(business_id) WHERE status IN ('pending', 'in_progress');

-- 3. JOB_CHECKLIST_ITEMS TABLE
-- Individual checklist items with completion status
CREATE TABLE public.job_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_checklist_id uuid NOT NULL REFERENCES public.job_checklists(id) ON DELETE CASCADE,
  template_item_id text,
  item_order integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  description text,
  category text,
  photo_required boolean NOT NULL DEFAULT false,
  min_photos integer NOT NULL DEFAULT 0 CHECK (min_photos >= 0),
  max_photos integer NOT NULL DEFAULT 10 CHECK (max_photos >= 0 AND max_photos <= 20),
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  checked_by uuid REFERENCES public.profiles(id),
  checked_by_name text,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  photo_ids uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT min_lte_max_photos CHECK (min_photos <= max_photos)
);

-- Indexes for job_checklist_items
CREATE INDEX idx_checklist_items_checklist ON public.job_checklist_items(job_checklist_id);
CREATE INDEX idx_checklist_items_order ON public.job_checklist_items(job_checklist_id, item_order);
CREATE INDEX idx_checklist_items_unchecked ON public.job_checklist_items(job_checklist_id) WHERE checked = false;

-- 4. CHECKLIST_EVENTS TABLE (Audit Trail)
-- Immutable log of all checklist state changes
CREATE TABLE public.checklist_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_checklist_id uuid NOT NULL REFERENCES public.job_checklists(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created', 'item_checked', 'item_unchecked', 'photo_attached', 
    'photo_removed', 'note_added', 'completed', 'waived', 'reopened'
  )),
  actor_id uuid REFERENCES public.profiles(id),
  actor_name text,
  item_id uuid,
  item_label text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for checklist_events
CREATE INDEX idx_checklist_events_checklist ON public.checklist_events(job_checklist_id);
CREATE INDEX idx_checklist_events_business ON public.checklist_events(business_id, created_at DESC);
CREATE INDEX idx_checklist_events_type ON public.checklist_events(job_checklist_id, event_type);

-- 5. EXTEND JOBS TABLE
-- Add checklist-related columns to jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS service_type text,
ADD COLUMN IF NOT EXISTS checklist_id uuid REFERENCES public.job_checklists(id),
ADD COLUMN IF NOT EXISTS checklist_status text CHECK (checklist_status IS NULL OR checklist_status IN ('pending', 'in_progress', 'completed', 'waived')),
ADD COLUMN IF NOT EXISTS checklist_progress integer CHECK (checklist_progress IS NULL OR (checklist_progress >= 0 AND checklist_progress <= 100));

-- Index for jobs checklist columns
CREATE INDEX IF NOT EXISTS idx_jobs_checklist_status ON public.jobs(business_id, checklist_status) WHERE checklist_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_service_type ON public.jobs(business_id, service_type) WHERE service_type IS NOT NULL;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_events ENABLE ROW LEVEL SECURITY;

-- CHECKLIST_TEMPLATES POLICIES

-- SELECT: Same business, not deleted
CREATE POLICY "checklist_templates_select" ON public.checklist_templates
FOR SELECT USING (
  deleted_at IS NULL AND
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- INSERT: Same business (admin/owner check done in application)
CREATE POLICY "checklist_templates_insert" ON public.checklist_templates
FOR INSERT WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- UPDATE: Same business, not deleted
CREATE POLICY "checklist_templates_update" ON public.checklist_templates
FOR UPDATE USING (
  deleted_at IS NULL AND
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- DELETE: Same business (soft delete, so UPDATE policy handles it)
CREATE POLICY "checklist_templates_delete" ON public.checklist_templates
FOR DELETE USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- JOB_CHECKLISTS POLICIES

-- SELECT: Same business
CREATE POLICY "job_checklists_select" ON public.job_checklists
FOR SELECT USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- INSERT: Same business
CREATE POLICY "job_checklists_insert" ON public.job_checklists
FOR INSERT WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- UPDATE: Same business
CREATE POLICY "job_checklists_update" ON public.job_checklists
FOR UPDATE USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- JOB_CHECKLIST_ITEMS POLICIES

-- SELECT: Via checklist business check
CREATE POLICY "job_checklist_items_select" ON public.job_checklist_items
FOR SELECT USING (
  job_checklist_id IN (
    SELECT jc.id FROM public.job_checklists jc
    WHERE jc.business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- INSERT: Via checklist business check
CREATE POLICY "job_checklist_items_insert" ON public.job_checklist_items
FOR INSERT WITH CHECK (
  job_checklist_id IN (
    SELECT jc.id FROM public.job_checklists jc
    WHERE jc.business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- UPDATE: Via checklist business check
CREATE POLICY "job_checklist_items_update" ON public.job_checklist_items
FOR UPDATE USING (
  job_checklist_id IN (
    SELECT jc.id FROM public.job_checklists jc
    WHERE jc.business_id IN (
      SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- CHECKLIST_EVENTS POLICIES

-- SELECT: Same business
CREATE POLICY "checklist_events_select" ON public.checklist_events
FOR SELECT USING (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- INSERT: Same business (system/triggers also insert)
CREATE POLICY "checklist_events_insert" ON public.checklist_events
FOR INSERT WITH CHECK (
  business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

-- Trigger for checklist_templates
CREATE TRIGGER update_checklist_templates_updated_at
BEFORE UPDATE ON public.checklist_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for job_checklists
CREATE TRIGGER update_job_checklists_updated_at
BEFORE UPDATE ON public.job_checklists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for job_checklist_items
CREATE TRIGGER update_job_checklist_items_updated_at
BEFORE UPDATE ON public.job_checklist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();