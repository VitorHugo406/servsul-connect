CREATE OR REPLACE FUNCTION public.is_active_company_logo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.is_active AND c.logo_url IS NOT NULL AND (c.logo_url = _name OR c.logo_url LIKE '%/' || _name OR c.logo_url LIKE '%/' || _name || '?%'));
$$;
GRANT EXECUTE ON FUNCTION public.is_active_company_logo(text) TO anon, authenticated;
DROP POLICY IF EXISTS "Public read company logos" ON storage.objects;
CREATE POLICY "Public read active company logos" ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'company-logos' AND public.is_active_company_logo(name));