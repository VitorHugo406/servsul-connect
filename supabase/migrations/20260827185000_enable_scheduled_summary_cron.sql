-- Run the scheduled chat/group summary worker every minute.
-- The Edge Function has verify_jwt=false in config.toml, so pg_net can invoke it
-- without storing a service-role key in the database.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nuvexa-send-scheduled-summaries') THEN
    PERFORM cron.unschedule('nuvexa-send-scheduled-summaries');
  END IF;
END
$$;

SELECT cron.schedule(
  'nuvexa-send-scheduled-summaries',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://efkhsesptcoukapcdllg.supabase.co/functions/v1/send-scheduled-summary',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := '{}'::jsonb
    );
  $$
);
