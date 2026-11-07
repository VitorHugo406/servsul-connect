-- End-to-end encrypted voice messages (WhatsApp-like).
-- * Every device (phone, PC) creates its own ECDH P-256 key pair in the browser; the private
--   key never leaves the device (non-extractable). Only the public key is stored here.
-- * The sender encrypts the audio with a random AES-256-GCM key, uploads only the ciphertext
--   to the private 'voice' bucket and stores that key sealed for each recipient device.
--   The server never sees the audio nor the key.
-- * Ciphertext is kept 7 days (voice-cleanup function), like other chat media.

CREATE TABLE IF NOT EXISTS public.e2e_device_keys (
  device_id uuid PRIMARY KEY,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  public_key jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS e2e_device_keys_profile_idx ON public.e2e_device_keys (profile_id);
ALTER TABLE public.e2e_device_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company reads device public keys" ON public.e2e_device_keys;
CREATE POLICY "Company reads device public keys" ON public.e2e_device_keys FOR SELECT TO authenticated
  USING (public.same_company(company_id));
DROP POLICY IF EXISTS "Own device keys" ON public.e2e_device_keys;
CREATE POLICY "Own device keys" ON public.e2e_device_keys FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());
DROP POLICY IF EXISTS "Own device keys update" ON public.e2e_device_keys;
CREATE POLICY "Own device keys update" ON public.e2e_device_keys FOR UPDATE TO authenticated
  USING (profile_id = public.get_current_profile_id()) WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());
DROP POLICY IF EXISTS "Own device keys delete" ON public.e2e_device_keys;
CREATE POLICY "Own device keys delete" ON public.e2e_device_keys FOR DELETE TO authenticated
  USING (profile_id = public.get_current_profile_id());

CREATE TABLE IF NOT EXISTS public.e2e_media (
  path text PRIMARY KEY,
  company_id uuid NOT NULL DEFAULT public.current_company_id(),
  sender_profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.e2e_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sender registers media" ON public.e2e_media;
CREATE POLICY "Sender registers media" ON public.e2e_media FOR INSERT TO authenticated
  WITH CHECK (sender_profile_id = public.get_current_profile_id() AND company_id = public.current_company_id()
              AND path LIKE company_id::text || '/' || auth.uid()::text || '/%');
DROP POLICY IF EXISTS "Company reads media" ON public.e2e_media;
CREATE POLICY "Company reads media" ON public.e2e_media FOR SELECT TO authenticated USING (public.same_company(company_id));

-- Sealed content key per recipient device.
CREATE TABLE IF NOT EXISTS public.e2e_media_keys (
  media_path text NOT NULL REFERENCES public.e2e_media(path) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.e2e_device_keys(device_id) ON DELETE CASCADE,
  epk jsonb NOT NULL,
  iv text NOT NULL,
  wrapped text NOT NULL,
  PRIMARY KEY (media_path, device_id)
);
ALTER TABLE public.e2e_media_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sender writes sealed keys" ON public.e2e_media_keys;
CREATE POLICY "Sender writes sealed keys" ON public.e2e_media_keys FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.e2e_media m WHERE m.path = media_path AND m.sender_profile_id = public.get_current_profile_id()));
DROP POLICY IF EXISTS "Device owner reads its key" ON public.e2e_media_keys;
CREATE POLICY "Device owner reads its key" ON public.e2e_media_keys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.e2e_device_keys d WHERE d.device_id = e2e_media_keys.device_id AND d.profile_id = public.get_current_profile_id()));

-- Private bucket with ciphertext only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice', 'voice', false, 3145728, ARRAY['application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "Company reads voice ciphertext" ON storage.objects;
CREATE POLICY "Company reads voice ciphertext" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice' AND (storage.foldername(name))[1] = public.current_company_id()::text);
DROP POLICY IF EXISTS "Users upload own voice ciphertext" ON storage.objects;
CREATE POLICY "Users upload own voice ciphertext" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice' AND (storage.foldername(name))[1] = public.current_company_id()::text
              AND (storage.foldername(name))[2] = auth.uid()::text);

-- 7-day retention: the voice-cleanup function removes the files; this lists them.
CREATE OR REPLACE FUNCTION public.expired_voice_media(_secret text, _limit int DEFAULT 500)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT path FROM public.e2e_media
  WHERE created_at < now() - interval '7 days'
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'push_secret' AND decrypted_secret = _secret)
  ORDER BY created_at LIMIT _limit
$$;
REVOKE ALL ON FUNCTION public.expired_voice_media(text, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expired_voice_media(text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_voice_cleanup()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net AS $$
DECLARE s text;
BEGIN
  SELECT decrypted_secret INTO s FROM vault.decrypted_secrets WHERE name = 'push_secret';
  IF s IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/voice-cleanup',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s), body := '{}'::jsonb, timeout_milliseconds := 20000);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_voice_cleanup() FROM public, anon, authenticated;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ewvon-voice-cleanup';
SELECT cron.schedule('ewvon-voice-cleanup', '17 * * * *', $$SELECT public.enqueue_voice_cleanup()$$);
