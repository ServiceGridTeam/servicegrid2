-- Fix function search_path for calculate_distance_meters
CREATE OR REPLACE FUNCTION public.calculate_distance_meters(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  earth_radius_meters CONSTANT INTEGER := 6371000;
  lat1_rad DOUBLE PRECISION;
  lat2_rad DOUBLE PRECISION;
  delta_lat DOUBLE PRECISION;
  delta_lng DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  lat1_rad := radians(lat1);
  lat2_rad := radians(lat2);
  delta_lat := radians(lat2 - lat1);
  delta_lng := radians(lng2 - lng1);
  
  a := sin(delta_lat / 2) * sin(delta_lat / 2) +
       cos(lat1_rad) * cos(lat2_rad) *
       sin(delta_lng / 2) * sin(delta_lng / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN (earth_radius_meters * c)::INTEGER;
END;
$$;