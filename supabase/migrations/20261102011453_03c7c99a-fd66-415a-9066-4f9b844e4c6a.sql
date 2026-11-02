CREATE OR REPLACE FUNCTION public.public_find_company(_query text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
SELECT c.id,c.name,c.slug,c.logo_url,c.primary_color,c.secondary_color,c.is_system
FROM public.companies c
WHERE c.is_active=true
AND (lower(trim(c.slug))=lower(trim(coalesce(_query,''))) OR lower(trim(c.name))=lower(trim(coalesce(_query,''))))
LIMIT 1;
$function$;
CREATE OR REPLACE FUNCTION public.public_get_company_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text, primary_color text, secondary_color text, is_system boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
SELECT c.id,c.name,c.slug,c.logo_url,c.primary_color,c.secondary_color,c.is_system
FROM public.companies c
WHERE c.slug=_slug AND c.is_active=true
LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public.public_find_company(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_get_company_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_find_company(text) TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.public_get_company_by_slug(text) TO anon,authenticated,service_role;
DO $test$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.public_find_company('Admin') WHERE slug='admin' AND is_system=true) THEN RAISE EXCEPTION 'Admin lookup regression'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.public_get_company_by_slug('admin') WHERE is_system=true) THEN RAISE EXCEPTION 'Admin login regression'; END IF;
END;
$test$;