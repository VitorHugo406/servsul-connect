-- Native Android app (no Chrome, no Firebase): the app keeps its own connection to the server (long poll, see the
-- `native-poll` edge function). Each installed app registers a device secret for the signed-in person; send-push
-- writes the same notifications it sends as Web Push into native_events, and the app shows them (calls ring non-stop).
CREATE TABLE IF NOT EXISTS public.native_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz
);
CREATE INDEX IF NOT EXISTS native_devices_profile_idx ON public.native_devices (profile_id);
CREATE TABLE IF NOT EXISTS public.native_events (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS native_events_profile_idx ON public.native_events (profile_id, id);
ALTER TABLE public.native_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.native_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_devices, public.native_events FROM anon, authenticated;

-- Called by the web app running inside the Android app after login: returns the secret that identifies this device.
CREATE OR REPLACE FUNCTION public.native_register(_label text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE me uuid := public.get_current_profile_id(); s text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  s := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.native_devices (profile_id, secret_hash, label) VALUES (me, encode(digest(s, 'sha256'), 'hex'), left(_label, 80));
  RETURN s;
END $$;
REVOKE EXECUTE ON FUNCTION public.native_register(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.native_register(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.native_unregister(_secret text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  DELETE FROM public.native_devices WHERE secret_hash = encode(digest(_secret, 'sha256'), 'hex');
$$;
REVOKE EXECUTE ON FUNCTION public.native_unregister(text) FROM public;
GRANT EXECUTE ON FUNCTION public.native_unregister(text) TO anon, authenticated;
