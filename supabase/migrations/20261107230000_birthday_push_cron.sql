-- Daily birthday notification (Web Push) at 09:00 America/Sao_Paulo (12:00 UTC).
-- Calls the send-push edge function with the vault 'push_secret'.
CREATE OR REPLACE FUNCTION public.enqueue_birthday_push()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net AS $$
DECLARE s text;
BEGIN
  SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'push_secret';
  IF s IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    body := jsonb_build_object('table', 'birthday_daily', 'record', jsonb_build_object()),
    timeout_milliseconds := 20000
  );
END $$;
REVOKE ALL ON FUNCTION public.enqueue_birthday_push() FROM public, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ewvon-birthday-push';
SELECT cron.schedule('ewvon-birthday-push', '0 12 * * *', $$SELECT public.enqueue_birthday_push()$$);
