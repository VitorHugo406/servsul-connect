
-- Drop overly permissive SELECT policies on eval_* tables
DROP POLICY IF EXISTS "Authenticated can view competencies" ON public.eval_competencies;
DROP POLICY IF EXISTS "Authenticated can view cycles" ON public.eval_cycles;
DROP POLICY IF EXISTS "Authenticated can view position competencies" ON public.eval_position_competencies;
DROP POLICY IF EXISTS "Authenticated can view positions" ON public.eval_positions;

-- Fix messages: drop permissive realtime read/broadcast policies
DROP POLICY IF EXISTS "authenticated can read realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can broadcast realtime" ON public.messages;

-- Fix realtime.messages: drop permissive broadcast/read policies
DROP POLICY IF EXISTS "authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can broadcast realtime" ON realtime.messages;

-- Announcement comments: scope to same company via parent announcement
DROP POLICY IF EXISTS "Usuarios autenticados podem ver comentarios" ON public.announcement_comments;
CREATE POLICY "Same company can view announcement comments"
ON public.announcement_comments FOR SELECT
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = announcement_comments.announcement_id
      AND public.same_company(a.company_id)
  )
);

-- Announcements: replace broad SELECT with same_company scoping
DROP POLICY IF EXISTS "Todos podem ver avisos" ON public.announcements;
CREATE POLICY "Same company can view announcements"
ON public.announcements FOR SELECT
USING (auth.uid() IS NOT NULL AND public.same_company(company_id));

-- Team members: scope to same company via parent team
DROP POLICY IF EXISTS "Authenticated can view team members" ON public.team_members;
CREATE POLICY "Same company can view team members"
ON public.team_members FOR SELECT
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND public.same_company(t.company_id)
  )
);
