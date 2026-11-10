-- Integrations are per company: even the super admin only sees the integrations of the company they are signed into.
DROP POLICY IF EXISTS "Company admins read integrations" ON public.company_integrations;
CREATE POLICY "Company admins read integrations" ON public.company_integrations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());
DROP POLICY IF EXISTS "Company admins read deliveries" ON public.integration_deliveries;
CREATE POLICY "Company admins read deliveries" ON public.integration_deliveries FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());
DROP POLICY IF EXISTS "Admins view integration metadata in their company" ON public.api_integrations;
CREATE POLICY "Admins view integration metadata in their company" ON public.api_integrations FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin());
