-- Announcements: company admins, or collaborators the admin flagged with "Postar avisos" in Gestão (user_permissions.can_post_announcements).
-- Managers (gerente) no longer get it automatically.
DROP POLICY IF EXISTS "Somente admins criam avisos" ON public.announcements;
DROP POLICY IF EXISTS "Admins ou permitidos criam avisos" ON public.announcements;
CREATE POLICY "Admins ou permitidos criam avisos" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (same_company(company_id) AND author_id = get_current_profile_id() AND (is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions up WHERE up.user_id = (SELECT auth.uid()) AND up.can_post_announcements)));
