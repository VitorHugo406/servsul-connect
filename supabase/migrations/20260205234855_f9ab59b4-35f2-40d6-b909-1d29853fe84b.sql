
-- Table for supervisors to manage their responsible collaborators
CREATE TABLE public.supervisor_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL,
  member_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, member_profile_id)
);

ALTER TABLE public.supervisor_team_members ENABLE ROW LEVEL SECURITY;

-- Supervisors can manage their own team
CREATE POLICY "Supervisors can view their team"
  ON public.supervisor_team_members FOR SELECT
  USING (supervisor_id = auth.uid() OR is_admin());

CREATE POLICY "Supervisors can add team members"
  ON public.supervisor_team_members FOR INSERT
  WITH CHECK (supervisor_id = auth.uid() OR is_admin());

CREATE POLICY "Supervisors can remove team members"
  ON public.supervisor_team_members FOR DELETE
  USING (supervisor_id = auth.uid() OR is_admin());
