
-- messages: drop overly-permissive realtime policies
DROP POLICY IF EXISTS "authenticated can broadcast realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can read realtime" ON public.messages;

-- profiles: scope SELECT to same company
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles in their company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.check_user_is_active()
  AND (
    public.is_super_admin()
    OR company_id = public.current_company_id()
    OR user_id = auth.uid()
  )
);

-- eval_positions
DROP POLICY IF EXISTS "Authenticated can view eval_positions" ON public.eval_positions;
DROP POLICY IF EXISTS "Todos podem ver eval_positions" ON public.eval_positions;
DROP POLICY IF EXISTS "Anyone can view eval_positions" ON public.eval_positions;
CREATE POLICY "Same company can view eval_positions"
ON public.eval_positions FOR SELECT TO authenticated
USING (public.same_company(company_id));

-- eval_competencies
DROP POLICY IF EXISTS "Authenticated can view eval_competencies" ON public.eval_competencies;
DROP POLICY IF EXISTS "Todos podem ver eval_competencies" ON public.eval_competencies;
DROP POLICY IF EXISTS "Anyone can view eval_competencies" ON public.eval_competencies;
CREATE POLICY "Same company can view eval_competencies"
ON public.eval_competencies FOR SELECT TO authenticated
USING (public.same_company(company_id));

-- eval_cycles
DROP POLICY IF EXISTS "Authenticated can view eval_cycles" ON public.eval_cycles;
DROP POLICY IF EXISTS "Todos podem ver eval_cycles" ON public.eval_cycles;
DROP POLICY IF EXISTS "Anyone can view eval_cycles" ON public.eval_cycles;
CREATE POLICY "Same company can view eval_cycles"
ON public.eval_cycles FOR SELECT TO authenticated
USING (public.same_company(company_id));

-- eval_position_competencies (join table — scope via parent position)
DROP POLICY IF EXISTS "Authenticated can view eval_position_competencies" ON public.eval_position_competencies;
DROP POLICY IF EXISTS "Todos podem ver eval_position_competencies" ON public.eval_position_competencies;
DROP POLICY IF EXISTS "Anyone can view eval_position_competencies" ON public.eval_position_competencies;
CREATE POLICY "Same company can view eval_position_competencies"
ON public.eval_position_competencies FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eval_positions ep
    WHERE ep.id = eval_position_competencies.position_id
      AND public.same_company(ep.company_id)
  )
);

-- important_announcements
DROP POLICY IF EXISTS "Anyone can view active important announcements" ON public.important_announcements;
CREATE POLICY "Same company can view active important announcements"
ON public.important_announcements FOR SELECT TO authenticated
USING (is_active = true AND public.same_company(company_id));

-- sectors
DROP POLICY IF EXISTS "Todos podem ver setores" ON public.sectors;
CREATE POLICY "Same company can view sectors"
ON public.sectors FOR SELECT TO authenticated
USING (
  id = '00000000-0000-0000-0000-000000000001'::uuid
  OR public.same_company(company_id)
);

-- teams
DROP POLICY IF EXISTS "Authenticated can view teams" ON public.teams;
CREATE POLICY "Same company can view teams"
ON public.teams FOR SELECT TO authenticated
USING (public.same_company(company_id));
