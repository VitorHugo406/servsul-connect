
CREATE OR REPLACE FUNCTION public.public_find_company(_query text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color, c.is_system
  FROM public.companies c
  WHERE c.is_active = true
    AND (
      lower(c.slug) = lower(coalesce(_query,''))
      OR lower(c.name) = lower(coalesce(_query,''))
      OR lower(c.name) LIKE lower(coalesce(_query,'')) || '%'
      OR lower(c.slug) LIKE lower(coalesce(_query,'')) || '%'
    )
  ORDER BY
    CASE WHEN lower(c.slug) = lower(coalesce(_query,'')) OR lower(c.name) = lower(coalesce(_query,'')) THEN 0 ELSE 1 END,
    length(c.name)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.public_find_company(text) TO anon, authenticated;
