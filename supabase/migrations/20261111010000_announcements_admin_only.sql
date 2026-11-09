-- Only company admins (user_roles.role = 'admin') create announcements; the old gerente / can_post_announcements paths are closed.
DROP POLICY IF EXISTS "Usuários com permissão podem criar avisos" ON public.announcements;
DROP POLICY IF EXISTS "Somente admins criam avisos" ON public.announcements;
CREATE POLICY "Somente admins criam avisos" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (same_company(company_id) AND author_id = get_current_profile_id() AND is_admin());
UPDATE public.user_permissions SET can_post_announcements = false WHERE can_post_announcements;
