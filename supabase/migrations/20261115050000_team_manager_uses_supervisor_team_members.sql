-- "Minha equipe" (Gestão de pessoas) stores members in supervisor_team_members; the older teams/team_members also count.
CREATE OR REPLACE FUNCTION public.is_team_manager_of(_profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND _profile IS DISTINCT FROM public.get_current_profile_id() AND (
    EXISTS (
      SELECT 1 FROM public.supervisor_team_members s
      JOIN public.profiles p ON p.id = s.member_profile_id
      WHERE s.supervisor_id = auth.uid() AND s.member_profile_id = _profile AND public.same_company(p.company_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.teams t ON t.id = tm.team_id
      JOIN public.profiles p ON p.id = tm.profile_id
      WHERE tm.profile_id = _profile AND t.supervisor_id = auth.uid()
        AND t.company_id = p.company_id AND public.same_company(t.company_id)
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.my_team_people() RETURNS TABLE (profile_id uuid, name text, sector_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, coalesce(nullif(p.display_name, ''), p.name), s.name
  FROM public.profiles p
  LEFT JOIN public.sectors s ON s.id = p.sector_id
  WHERE p.is_active AND public.same_company(p.company_id) AND p.id <> public.get_current_profile_id()
    AND (
      EXISTS (SELECT 1 FROM public.supervisor_team_members st WHERE st.supervisor_id = auth.uid() AND st.member_profile_id = p.id)
      OR EXISTS (SELECT 1 FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id WHERE tm.profile_id = p.id AND t.supervisor_id = auth.uid() AND t.company_id = p.company_id)
    )
$$;
