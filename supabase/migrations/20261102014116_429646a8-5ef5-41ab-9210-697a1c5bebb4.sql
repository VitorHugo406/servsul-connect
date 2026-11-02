DROP POLICY IF EXISTS "Only admins and supervisors can manage api integrations" ON public.api_integrations;
CREATE POLICY "Admins view integration metadata in their company" ON public.api_integrations FOR SELECT TO authenticated USING (public.is_super_admin() OR (company_id = public.current_company_id() AND public.is_admin()));
REVOKE ALL ON public.api_integrations FROM anon, authenticated;
REVOKE SELECT (api_key_hash, api_token_hash) ON public.api_integrations FROM anon, authenticated;
GRANT SELECT (id, company_id, name, api_key_hint, is_active, created_by, created_at, updated_at, last_used_at, scope_all_companies) ON public.api_integrations TO authenticated;
GRANT ALL ON public.api_integrations TO service_role;