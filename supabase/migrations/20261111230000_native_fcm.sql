-- Firebase Cloud Messaging for the native app: each device may carry its FCM token; every native event also goes to Firebase
-- (function `fcm-send`, called by the trigger below), so the system itself wakes the app when it was closed.
ALTER TABLE public.native_devices ADD COLUMN IF NOT EXISTS fcm_token text;

CREATE OR REPLACE FUNCTION public.native_set_fcm(_secret text, _token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  UPDATE public.native_devices SET fcm_token = left(_token, 400) WHERE secret_hash = encode(digest(_secret, 'sha256'), 'hex');
$$;
REVOKE EXECUTE ON FUNCTION public.native_set_fcm(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.native_set_fcm(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.native_events_to_fcm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net AS $$
DECLARE s text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.native_devices WHERE profile_id = NEW.profile_id AND fcm_token IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'push_secret';
  IF s IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/fcm-send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    body := jsonb_build_object('profile_id', NEW.profile_id, 'payload', NEW.payload),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS native_events_fcm ON public.native_events;
CREATE TRIGGER native_events_fcm AFTER INSERT ON public.native_events FOR EACH ROW EXECUTE FUNCTION public.native_events_to_fcm();
