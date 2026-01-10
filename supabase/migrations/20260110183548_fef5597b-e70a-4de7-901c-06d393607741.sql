-- Fix the search_photos function to properly handle media_category enum comparison
DROP FUNCTION IF EXISTS public.search_photos(uuid, text, text[], text[], uuid, uuid, date, date, boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.search_photos(
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
      -- Cast enum to text for comparison with text array
      AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR msi.category::text = ANY(p_categories))
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
    f.category::text,
    f.tags,
    f.captured_date,
    f.has_gps,
    f.total
  FROM filtered f;
END;
$$;