-- Every admin of the company can post notices (admin role, autonomy admin/gerente, or the
-- explicit can_post_announcements permission) — the same rule the app screens use.
DROP POLICY IF EXISTS "Usuários com permissão podem criar avisos" ON public.announcements;
CREATE POLICY "Usuários com permissão podem criar avisos" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    same_company(company_id) AND author_id = get_current_profile_id() AND (
      is_admin() OR has_autonomy_level('gerente')
      OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = (SELECT auth.uid()) AND up.can_post_announcements = true)
    )
  );
