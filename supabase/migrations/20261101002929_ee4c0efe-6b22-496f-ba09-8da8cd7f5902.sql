ALTER TABLE public.supervisor_team_members ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_stm_team_id ON public.supervisor_team_members(team_id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_alerts_enabled boolean NOT NULL DEFAULT false;