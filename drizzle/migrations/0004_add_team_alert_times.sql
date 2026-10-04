ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS team_alert_times text[] NOT NULL DEFAULT ARRAY['06:00']::text[];

COMMENT ON COLUMN public.profiles.team_alert_times IS 'Daily America/Sao_Paulo times when this manager wants team workload alerts generated.';