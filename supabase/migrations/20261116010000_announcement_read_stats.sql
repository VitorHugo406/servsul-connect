-- Leitura dos avisos (tela Avisos): quantas pessoas leram cada aviso e quantas há na empresa.
-- Só administradores e quem tem "Postar avisos" enxergam os números, e só da própria empresa.
CREATE OR REPLACE FUNCTION public.announcement_read_stats(_ids uuid[])
RETURNS TABLE(announcement_id uuid, reads integer, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.current_company_id() AS cid
    WHERE public.is_admin() OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = (SELECT auth.uid()) AND up.can_post_announcements)
  ), tot AS (
    SELECT count(*)::int AS n FROM public.profiles p, me WHERE p.company_id = me.cid AND p.is_active
  )
  SELECT a.id, (SELECT count(*)::int FROM public.announcement_reads r WHERE r.announcement_id = a.id), tot.n
  FROM public.announcements a, me, tot
  WHERE a.id = ANY(_ids) AND a.company_id = me.cid;
$$;
REVOKE ALL ON FUNCTION public.announcement_read_stats(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announcement_read_stats(uuid[]) TO authenticated;
