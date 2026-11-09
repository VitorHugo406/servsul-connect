-- Hourly refresh of video usage per company (alerts + overage), and bookkeeping for adding the overage
-- to the next charge.
ALTER TABLE public.company_video_usage ADD COLUMN IF NOT EXISTS synced_at timestamptz;
SELECT cron.unschedule('ewvon-video-usage') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-video-usage');
SELECT cron.schedule('ewvon-video-usage', '17 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/video/refresh',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := '{}'::jsonb
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret'
$cron$);
