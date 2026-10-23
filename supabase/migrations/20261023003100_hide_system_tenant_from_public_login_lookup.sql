-- Do not expose the internal system tenant through public login lookup RPCs.
CREATE OR REPLACE FUNCTION public.public_find_company(_query text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color, false::boolean
  FROM public.companies c
  WHERE c.is_active = true AND c.is_system = false
    AND (lower(trim(c.slug)) = lower(trim(coalesce(_query,'')))
      OR lower(trim(c.name)) = lower(trim(coalesce(_query,''))))
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.public_get_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, c.secondary_color, false::boolean
  FROM public.companies c
  WHERE c.slug = _slug AND c.is_active = true AND c.is_system = false
  LIMIT 1
$function$;
