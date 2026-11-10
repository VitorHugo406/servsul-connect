-- WhatsApp-like call history: one row per chat call (ringing -> ongoing -> ended | missed | declined), with duration.
CREATE TABLE IF NOT EXISTS public.chat_calls (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conv text NOT NULL CHECK (conv IN ('dm', 'group', 'sector')),
  target text NOT NULL,                     -- dm: other profile id; group: group id; sector: sector id
  audio boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_sec integer
);
CREATE INDEX IF NOT EXISTS chat_calls_company_idx ON public.chat_calls (company_id, created_at DESC);
ALTER TABLE public.chat_calls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_calls FROM anon, authenticated;
GRANT SELECT ON public.chat_calls TO authenticated;
DROP POLICY IF EXISTS "Same company reads calls" ON public.chat_calls;
CREATE POLICY "Same company reads calls" ON public.chat_calls FOR SELECT TO authenticated USING (company_id = public.current_company_id());

CREATE OR REPLACE FUNCTION public.call_create(_id uuid, _conv text, _target text, _audio boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.get_current_profile_id(); co uuid := public.current_company_id();
BEGIN
  IF me IS NULL OR co IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.chat_calls (id, company_id, caller_id, conv, target, audio) VALUES (_id, co, me, _conv, _target, _audio)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Someone connected: the call is answered (first time only).
CREATE OR REPLACE FUNCTION public.call_answered(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.chat_calls SET answered_at = coalesce(answered_at, now()), status = 'ongoing'
   WHERE id = _id AND company_id = public.current_company_id() AND ended_at IS NULL;
$$;

-- The call is over (last person left, nobody answered, or the other side declined).
CREATE OR REPLACE FUNCTION public.call_end(_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.chat_calls SET ended_at = now(),
         status = CASE WHEN answered_at IS NOT NULL THEN 'ended' WHEN _reason = 'declined' THEN 'declined' ELSE 'missed' END,
         duration_sec = CASE WHEN answered_at IS NOT NULL THEN greatest(0, extract(epoch FROM now() - answered_at)::int) END
   WHERE id = _id AND company_id = public.current_company_id() AND ended_at IS NULL
  RETURNING jsonb_build_object('status', status, 'duration_sec', duration_sec);
$$;

REVOKE EXECUTE ON FUNCTION public.call_create(uuid, text, text, boolean), public.call_answered(uuid), public.call_end(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.call_create(uuid, text, text, boolean), public.call_answered(uuid), public.call_end(uuid, text) TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
