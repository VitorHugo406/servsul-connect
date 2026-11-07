-- E2E voice: a device that joined after a voice note was sent asks for its key; the
-- sender's device (which can still open the note) re-seals the key for it, after checking
-- in the app that the requester is a member of that conversation (WhatsApp-like
-- "waiting for this message"). The server never sees the audio key.
ALTER TABLE public.e2e_media ADD COLUMN IF NOT EXISTS chat_key text;

CREATE TABLE IF NOT EXISTS public.e2e_key_requests (
  media_path text NOT NULL REFERENCES public.e2e_media(path) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.e2e_device_keys(device_id) ON DELETE CASCADE,
  requester_profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_path, device_id)
);
ALTER TABLE public.e2e_key_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Requester asks for own device" ON public.e2e_key_requests;
CREATE POLICY "Requester asks for own device" ON public.e2e_key_requests FOR INSERT TO authenticated
  WITH CHECK (requester_profile_id = public.get_current_profile_id()
    AND EXISTS (SELECT 1 FROM public.e2e_device_keys d WHERE d.device_id = e2e_key_requests.device_id AND d.profile_id = public.get_current_profile_id())
    AND EXISTS (SELECT 1 FROM public.e2e_media m WHERE m.path = media_path AND public.same_company(m.company_id)));
DROP POLICY IF EXISTS "Sender and requester see requests" ON public.e2e_key_requests;
CREATE POLICY "Sender and requester see requests" ON public.e2e_key_requests FOR SELECT TO authenticated
  USING (requester_profile_id = public.get_current_profile_id()
    OR EXISTS (SELECT 1 FROM public.e2e_media m WHERE m.path = media_path AND m.sender_profile_id = public.get_current_profile_id()));
DROP POLICY IF EXISTS "Sender and requester remove requests" ON public.e2e_key_requests;
CREATE POLICY "Sender and requester remove requests" ON public.e2e_key_requests FOR DELETE TO authenticated
  USING (requester_profile_id = public.get_current_profile_id()
    OR EXISTS (SELECT 1 FROM public.e2e_media m WHERE m.path = media_path AND m.sender_profile_id = public.get_current_profile_id()));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'e2e_key_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.e2e_key_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'e2e_media_keys') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.e2e_media_keys;
  END IF;
END $$;
