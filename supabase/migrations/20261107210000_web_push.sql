-- Real Web Push for the installed app (PWA): notifications arrive even with the app
-- closed. Devices store their push subscription here; inserts on chat/notice tables
-- call the send-push edge function (pg_net), authenticated by the vault secret
-- 'push_secret'. The VAPID keys live in the vault ('vapid_private_key', 'vapid_public_key'),
-- created out of band, and are only readable by the service role.

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  endpoint text PRIMARY KEY,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_profile_idx ON public.web_push_subscriptions (profile_id);
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Own push subscriptions" ON public.web_push_subscriptions FOR ALL TO authenticated
  USING (profile_id = public.get_current_profile_id())
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());

-- Service-role only: config for the send-push function.
CREATE OR REPLACE FUNCTION public.push_config(_secret text)
RETURNS TABLE(public_key text, private_key text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_public_key'),
         (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'vapid_private_key')
  WHERE _secret IS NOT NULL AND length(_secret) >= 32
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_secret' AND decrypted_secret = _secret)
$$;
REVOKE ALL ON FUNCTION public.push_config(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_config(text) TO service_role;

-- Fire-and-forget call to the edge function for every new message / notice.
CREATE OR REPLACE FUNCTION public.enqueue_web_push()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net AS $$
DECLARE s text;
BEGIN
  SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'push_secret';
  IF s IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW)),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block a message because of push
END $$;
REVOKE ALL ON FUNCTION public.enqueue_web_push() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS web_push_direct_messages ON public.direct_messages;
CREATE TRIGGER web_push_direct_messages AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_web_push();
DROP TRIGGER IF EXISTS web_push_messages ON public.messages;
CREATE TRIGGER web_push_messages AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_web_push();
DROP TRIGGER IF EXISTS web_push_group_messages ON public.private_group_messages;
CREATE TRIGGER web_push_group_messages AFTER INSERT ON public.private_group_messages FOR EACH ROW EXECUTE FUNCTION public.enqueue_web_push();
DROP TRIGGER IF EXISTS web_push_announcements ON public.announcements;
CREATE TRIGGER web_push_announcements AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.enqueue_web_push();
