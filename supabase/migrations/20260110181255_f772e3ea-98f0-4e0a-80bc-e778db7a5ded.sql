-- =============================================
-- PHOTO SEARCH INFRASTRUCTURE
-- Materialized view for fast full-text search
-- =============================================

-- Create materialized view for photo search
CREATE MATERIALIZED VIEW IF NOT EXISTS media_search_index AS
SELECT 
  jm.id as media_id,
  jm.business_id,
  jm.job_id,
  jm.customer_id,
  
  to_tsvector('english', 
    COALESCE(jm.description, '') || ' ' ||
    COALESCE(j.title, '') || ' ' ||
    COALESCE(j.description, '') || ' ' ||
    COALESCE(c.first_name, '') || ' ' ||
    COALESCE(c.last_name, '') || ' ' ||
    COALESCE(j.address_line1, '') || ' ' ||
    COALESCE(j.city, '') || ' ' ||
    array_to_string(COALESCE(jm.tag_slugs, '{}'), ' ')
  ) as search_vector,
  
  COALESCE(jm.tag_slugs, '{}') as tags,
  jm.category,
  DATE(COALESCE(jm.captured_at, jm.created_at)) as captured_date,
  jm.uploaded_by,
  (jm.latitude IS NOT NULL) as has_gps,
  
  jm.thumbnail_url_md as thumbnail_url,
  jm.url as media_url,
  jm.media_type,
  j.title as job_title,
  j.job_number,
  COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') as customer_name,
  COALESCE(j.address_line1, '') as address_summary,
  jm.created_at
  
FROM job_media jm
LEFT JOIN jobs j ON j.id = jm.job_id
LEFT JOIN customers c ON c.id = jm.customer_id
WHERE jm.deleted_at IS NULL AND jm.status = 'ready';

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_search_pk ON media_search_index(media_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_media_search_vector ON media_search_index USING gin(search_vector);

-- Tag array search
CREATE INDEX IF NOT EXISTS idx_media_search_tags ON media_search_index USING gin(tags);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_media_search_date ON media_search_index(business_id, captured_date DESC);

-- Customer timeline queries
CREATE INDEX IF NOT EXISTS idx_media_search_customer ON media_search_index(customer_id, captured_date DESC);

-- Job queries
CREATE INDEX IF NOT EXISTS idx_media_search_job ON media_search_index(job_id, captured_date DESC);

-- =============================================
-- SEARCH PHOTOS RPC FUNCTION
-- Paginated full-text search with filters
-- =============================================

CREATE OR REPLACE FUNCTION search_photos(
  p_business_id uuid,
  p_query text DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_has_gps boolean DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 50
)
RETURNS TABLE (
  media_id uuid,
  thumbnail_url text,
  media_url text,
  media_type text,
  job_id uuid,
  job_title text,
  job_number text,
  customer_id uuid,
  customer_name text,
  category text,
  tags text[],
  captured_date date,
  has_gps boolean,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer := (GREATEST(p_page, 1) - 1) * p_per_page;
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT 
      msi.*,
      COUNT(*) OVER() as total
    FROM media_search_index msi
    WHERE msi.business_id = p_business_id
      AND (p_query IS NULL OR p_query = '' OR msi.search_vector @@ plainto_tsquery('english', p_query))
      AND (p_tags IS NULL OR array_length(p_tags, 1) IS NULL OR msi.tags && p_tags)
      AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR msi.category = ANY(p_categories))
      AND (p_customer_id IS NULL OR msi.customer_id = p_customer_id)
      AND (p_job_id IS NULL OR msi.job_id = p_job_id)
      AND (p_date_from IS NULL OR msi.captured_date >= p_date_from)
      AND (p_date_to IS NULL OR msi.captured_date <= p_date_to)
      AND (p_has_gps IS NULL OR msi.has_gps = p_has_gps)
    ORDER BY 
      CASE WHEN p_query IS NOT NULL AND p_query != ''
        THEN ts_rank(msi.search_vector, plainto_tsquery('english', p_query)) 
        ELSE 0 
      END DESC,
      msi.captured_date DESC NULLS LAST,
      msi.created_at DESC
    LIMIT p_per_page
    OFFSET v_offset
  )
  SELECT 
    f.media_id,
    f.thumbnail_url,
    f.media_url,
    f.media_type,
    f.job_id,
    f.job_title,
    f.job_number,
    f.customer_id,
    f.customer_name,
    f.category,
    f.tags,
    f.captured_date,
    f.has_gps,
    f.total
  FROM filtered f;
END;
$$;

-- =============================================
-- GET PHOTO FACETS (for filter counts)
-- =============================================

CREATE OR REPLACE FUNCTION get_photo_facets(
  p_business_id uuid,
  p_query text DEFAULT NULL
)
RETURNS TABLE (
  facet_type text,
  facet_value text,
  facet_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Category counts
  SELECT 
    'category'::text as facet_type,
    msi.category::text as facet_value,
    COUNT(*)::bigint as facet_count
  FROM media_search_index msi
  WHERE msi.business_id = p_business_id
    AND (p_query IS NULL OR p_query = '' OR msi.search_vector @@ plainto_tsquery('english', p_query))
    AND msi.category IS NOT NULL
  GROUP BY msi.category
  
  UNION ALL
  
  -- Tag counts
  SELECT 
    'tag'::text as facet_type,
    unnest(msi.tags) as facet_value,
    COUNT(*)::bigint as facet_count
  FROM media_search_index msi
  WHERE msi.business_id = p_business_id
    AND (p_query IS NULL OR p_query = '' OR msi.search_vector @@ plainto_tsquery('english', p_query))
  GROUP BY unnest(msi.tags)
  
  UNION ALL
  
  -- GPS status counts
  SELECT 
    'has_gps'::text as facet_type,
    CASE WHEN msi.has_gps THEN 'true' ELSE 'false' END as facet_value,
    COUNT(*)::bigint as facet_count
  FROM media_search_index msi
  WHERE msi.business_id = p_business_id
    AND (p_query IS NULL OR p_query = '' OR msi.search_vector @@ plainto_tsquery('english', p_query))
  GROUP BY msi.has_gps;
END;
$$;

-- =============================================
-- REFRESH FUNCTION (for scheduled refresh)
-- =============================================

CREATE OR REPLACE FUNCTION refresh_media_search_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY media_search_index;
END;
$$;

-- =============================================
-- TRIGGER TO AUTO-REFRESH ON CHANGES
-- (Uses a flag table to debounce refreshes)
-- =============================================

CREATE TABLE IF NOT EXISTS media_search_refresh_queue (
  id integer PRIMARY KEY DEFAULT 1,
  needs_refresh boolean DEFAULT false,
  last_refresh_at timestamptz,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO media_search_refresh_queue (id, needs_refresh) 
VALUES (1, false) 
ON CONFLICT (id) DO NOTHING;

-- Function to mark index as needing refresh
CREATE OR REPLACE FUNCTION mark_media_search_stale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE media_search_refresh_queue SET needs_refresh = true WHERE id = 1;
  RETURN NULL;
END;
$$;

-- Trigger on job_media changes
DROP TRIGGER IF EXISTS trg_job_media_search_stale ON job_media;
CREATE TRIGGER trg_job_media_search_stale
AFTER INSERT OR UPDATE OR DELETE ON job_media
FOR EACH STATEMENT
EXECUTE FUNCTION mark_media_search_stale();

-- Initial refresh of materialized view
SELECT refresh_media_search_index();