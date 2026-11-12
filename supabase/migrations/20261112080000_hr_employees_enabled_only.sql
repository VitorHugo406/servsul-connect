-- Only people of sources that are switched on ("Usar no Dash") are readable.
DROP POLICY IF EXISTS "Admins and Dash users read HR employees" ON public.hr_employees;
CREATE POLICY "Admins and Dash users read HR employees" ON public.hr_employees FOR SELECT TO authenticated
  USING (company_id = public.current_company_id()
    AND EXISTS (SELECT 1 FROM public.hr_sources s WHERE s.id = hr_employees.source_id AND s.enabled)
    AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (select auth.uid()) AND up.can_access_dash)));
