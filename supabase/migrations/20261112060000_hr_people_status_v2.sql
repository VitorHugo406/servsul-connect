-- v2: columns are recognised automatically from the vendor's API (synonym dictionary), so the row carries a data blob
-- (departamento, cargo, faltas, horas extras, atrasos, banco de horas...) and the status may be unknown (null). Refresh: every minute.
ALTER TABLE public.hr_people_status ALTER COLUMN status DROP NOT NULL;
ALTER TABLE public.hr_people_status ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN PERFORM cron.unschedule('ewvon-hr-sync'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('ewvon-hr-sync', '* * * * *', $$SELECT public.hr_sync_tick()$$);
