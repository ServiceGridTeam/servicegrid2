-- ============================================
-- PHOTO ORGANIZATION & TAGGING - DATABASE FOUNDATION
-- ============================================

-- 1. Create media_tags table for business-scoped tags
CREATE TABLE public.media_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  color text DEFAULT 'gray' CHECK (color IN ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'gray')),
  icon text,
  is_system boolean DEFAULT false,
  tag_group text,
  sort_order integer DEFAULT 0,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (business_id, slug)
);

-- Indexes for media_tags
CREATE INDEX idx_media_tags_business ON media_tags(business_id, is_active);
CREATE INDEX idx_media_tags_group ON media_tags(business_id, tag_group) WHERE tag_group IS NOT NULL;
CREATE INDEX idx_media_tags_usage ON media_tags(business_id, usage_count DESC);

-- Enable RLS on media_tags
ALTER TABLE media_tags ENABLE ROW LEVEL SECURITY;

-- RLS: All business members can view tags
CREATE POLICY "Users can view tags in their business"
ON media_tags FOR SELECT
USING (user_belongs_to_business(business_id));

-- RLS: Admins/owners can create tags
CREATE POLICY "Admins can create tags"
ON media_tags FOR INSERT
WITH CHECK (
  user_belongs_to_business(business_id) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- RLS: Admins/owners can update tags
CREATE POLICY "Admins can update tags"
ON media_tags FOR UPDATE
USING (
  user_belongs_to_business(business_id) 
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- RLS: Admins/owners can delete non-system tags
CREATE POLICY "Admins can delete non-system tags"
ON media_tags FOR DELETE
USING (
  user_belongs_to_business(business_id) 
  AND is_system = false
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- 2. Create job_media_tags junction table
CREATE TABLE public.job_media_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_media_id uuid NOT NULL REFERENCES job_media(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES media_tags(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tagged_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tagged_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested', 'bulk_operation', 'auto_rule')),
  UNIQUE (job_media_id, tag_id)
);

-- Indexes for job_media_tags
CREATE INDEX idx_job_media_tags_media ON job_media_tags(job_media_id);
CREATE INDEX idx_job_media_tags_tag ON job_media_tags(tag_id);
CREATE INDEX idx_job_media_tags_business ON job_media_tags(business_id, tag_id);

-- Enable RLS on job_media_tags
ALTER TABLE job_media_tags ENABLE ROW LEVEL SECURITY;

-- RLS: All business members can view tags
CREATE POLICY "Users can view photo tags in their business"
ON job_media_tags FOR SELECT
USING (user_belongs_to_business(business_id));

-- RLS: Techs, admins, owners can tag/untag photos
CREATE POLICY "Techs and admins can manage photo tags"
ON job_media_tags FOR INSERT
WITH CHECK (user_belongs_to_business(business_id));

CREATE POLICY "Techs and admins can remove photo tags"
ON job_media_tags FOR DELETE
USING (user_belongs_to_business(business_id));

-- 3. Add search-related columns to job_media
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS search_text text,
ADD COLUMN IF NOT EXISTS tag_slugs text[] DEFAULT '{}';

-- Create GIN index for full-text search
CREATE INDEX idx_job_media_search ON job_media 
USING gin(to_tsvector('english', COALESCE(search_text, '')));

-- Create GIN index for tag slugs array
CREATE INDEX idx_job_media_tag_slugs ON job_media 
USING gin(tag_slugs);

-- 4. Trigger to update tag usage stats
CREATE OR REPLACE FUNCTION update_tag_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE media_tags 
    SET usage_count = usage_count + 1,
        last_used_at = now(),
        updated_at = now()
    WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE media_tags 
    SET usage_count = GREATEST(0, usage_count - 1),
        updated_at = now()
    WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_update_tag_usage
AFTER INSERT OR DELETE ON job_media_tags
FOR EACH ROW EXECUTE FUNCTION update_tag_usage_stats();

-- 5. Trigger to sync tag slugs to job_media
CREATE OR REPLACE FUNCTION sync_media_tag_slugs()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE job_media 
    SET tag_slugs = (
      SELECT array_agg(DISTINCT mt.slug)
      FROM job_media_tags jmt
      JOIN media_tags mt ON mt.id = jmt.tag_id
      WHERE jmt.job_media_id = NEW.job_media_id
    ),
    updated_at = now()
    WHERE id = NEW.job_media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE job_media 
    SET tag_slugs = COALESCE((
      SELECT array_agg(DISTINCT mt.slug)
      FROM job_media_tags jmt
      JOIN media_tags mt ON mt.id = jmt.tag_id
      WHERE jmt.job_media_id = OLD.job_media_id
    ), '{}'),
    updated_at = now()
    WHERE id = OLD.job_media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_sync_media_tag_slugs
AFTER INSERT OR DELETE ON job_media_tags
FOR EACH ROW EXECUTE FUNCTION sync_media_tag_slugs();

-- 6. Trigger to seed default tags on business creation
CREATE OR REPLACE FUNCTION seed_default_media_tags()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO media_tags (business_id, name, slug, color, is_system, sort_order, tag_group)
  VALUES
    (NEW.id, 'Before', 'before', 'blue', true, 1, 'documentation'),
    (NEW.id, 'During', 'during', 'yellow', true, 2, 'documentation'),
    (NEW.id, 'After', 'after', 'green', true, 3, 'documentation'),
    (NEW.id, 'Damage', 'damage', 'red', true, 4, 'issues'),
    (NEW.id, 'Equipment', 'equipment', 'purple', true, 5, 'assets'),
    (NEW.id, 'Materials', 'materials', 'gray', true, 6, 'assets');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_seed_business_tags
AFTER INSERT ON businesses
FOR EACH ROW EXECUTE FUNCTION seed_default_media_tags();

-- 7. Seed default tags for existing businesses
INSERT INTO media_tags (business_id, name, slug, color, is_system, sort_order, tag_group)
SELECT 
  b.id,
  t.name,
  t.slug,
  t.color,
  true,
  t.sort_order,
  t.tag_group
FROM businesses b
CROSS JOIN (
  VALUES 
    ('Before', 'before', 'blue', 1, 'documentation'),
    ('During', 'during', 'yellow', 2, 'documentation'),
    ('After', 'after', 'green', 3, 'documentation'),
    ('Damage', 'damage', 'red', 4, 'issues'),
    ('Equipment', 'equipment', 'purple', 5, 'assets'),
    ('Materials', 'materials', 'gray', 6, 'assets')
) AS t(name, slug, color, sort_order, tag_group)
WHERE NOT EXISTS (
  SELECT 1 FROM media_tags mt 
  WHERE mt.business_id = b.id AND mt.slug = t.slug
);

-- 8. Function to rebuild search text for a photo
CREATE OR REPLACE FUNCTION rebuild_media_search_text(p_media_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE job_media jm
  SET search_text = CONCAT_WS(' ',
    jm.description,
    (SELECT j.title FROM jobs j WHERE j.id = jm.job_id),
    (SELECT j.description FROM jobs j WHERE j.id = jm.job_id),
    (SELECT CONCAT(c.first_name, ' ', c.last_name) FROM customers c WHERE c.id = jm.customer_id),
    (SELECT string_agg(mt.name, ' ') FROM job_media_tags jmt JOIN media_tags mt ON mt.id = jmt.tag_id WHERE jmt.job_media_id = jm.id)
  ),
  updated_at = now()
  WHERE jm.id = p_media_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Trigger to update search text when description changes
CREATE OR REPLACE FUNCTION update_media_search_on_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM rebuild_media_search_text(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_update_media_search
AFTER UPDATE OF description ON job_media
FOR EACH ROW 
WHEN (OLD.description IS DISTINCT FROM NEW.description)
EXECUTE FUNCTION update_media_search_on_change();

-- 10. Also update search text when tags change
CREATE OR REPLACE FUNCTION update_media_search_on_tag_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM rebuild_media_search_text(NEW.job_media_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM rebuild_media_search_text(OLD.job_media_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tr_update_search_on_tag_change
AFTER INSERT OR DELETE ON job_media_tags
FOR EACH ROW EXECUTE FUNCTION update_media_search_on_tag_change();

-- 11. Enable realtime for job_media_tags
ALTER PUBLICATION supabase_realtime ADD TABLE job_media_tags;