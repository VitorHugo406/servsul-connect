ALTER TABLE public.supervisor_team_members ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_alerts_enabled boolean NOT NULL DEFAULT false;
INSERT INTO public.teams(name, supervisor_id, company_id)
SELECT COALESCE(max(s.team_name), 'Minha equipe'), s.supervisor_id, p.company_id
FROM public.supervisor_team_members s JOIN public.profiles p ON p.user_id = s.supervisor_id
WHERE NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.supervisor_id = s.supervisor_id)
GROUP BY s.supervisor_id, p.company_id;
UPDATE public.supervisor_team_members s SET team_id = (SELECT t.id FROM public.teams t WHERE t.supervisor_id = s.supervisor_id ORDER BY t.created_at LIMIT 1) WHERE team_id IS NULL;