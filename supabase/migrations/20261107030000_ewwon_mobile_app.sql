-- Ewwon mobile app: additive schema for the new mobile experience.
-- Only adds columns, tables and policies; existing data is untouched.

-- 1. Working hours on profiles (shown on the profile page, used by quiet hours)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_start time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end time NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS work_days boolean[] NOT NULL DEFAULT '{t,t,t,t,t,f,f}',
  ADD COLUMN IF NOT EXISTS status_until timestamptz;

-- 2. Group cover and chat wallpaper
ALTER TABLE public.private_groups
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS wallpaper jsonb NOT NULL DEFAULT '{"preset":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS automations jsonb NOT NULL DEFAULT '{"welcome":true}'::jsonb;

-- 3. "Ciente" (acknowledge) on announcements
ALTER TABLE public.announcement_reads ADD COLUMN IF NOT EXISTS acked_at timestamptz;
DROP POLICY IF EXISTS "Users can update their own announcement reads" ON public.announcement_reads;
CREATE POLICY "Users can update their own announcement reads" ON public.announcement_reads
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 4. Weekday-only daily summaries
ALTER TABLE public.scheduled_summaries ADD COLUMN IF NOT EXISTS weekdays_only boolean NOT NULL DEFAULT false;

-- 5. Per-conversation preferences (pin, mute, typography, bubble colour, wallpaper)
CREATE TABLE IF NOT EXISTS public.chat_member_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_key text NOT NULL CHECK (chat_key ~ '^(sector|dm|group):[0-9a-f-]{36}$'),
  pinned boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  muted_until timestamptz,
  font_size smallint NOT NULL DEFAULT 1 CHECK (font_size BETWEEN 0 AND 2),
  font_family smallint NOT NULL DEFAULT 0 CHECK (font_family BETWEEN 0 AND 2),
  bubble_color smallint NOT NULL DEFAULT 0 CHECK (bubble_color BETWEEN 0 AND 3),
  wallpaper smallint NOT NULL DEFAULT 0 CHECK (wallpaper BETWEEN 0 AND 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, chat_key)
);
ALTER TABLE public.chat_member_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own chat prefs" ON public.chat_member_prefs FOR ALL TO authenticated
  USING (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id())
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());

-- 6. Personal app preferences (notifications, appearance, privacy)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  profile_id uuid PRIMARY KEY DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (profile_id = public.get_current_profile_id())
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());

-- 7. Support tickets ("Reportar problema")
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Erro no sistema','Lentidão','Sugestão','Outro assunto')),
  area text,
  severity text CHECK (severity IN ('Leve','Moderado','Crítico')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
  screenshot_path text,
  device jsonb,
  status text NOT NULL DEFAULT 'Recebido' CHECK (status IN ('Recebido','Em análise','Resolvido','Fechado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_company_idx ON public.support_tickets (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_profile_idx ON public.support_tickets (profile_id, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users open own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id() AND status = 'Recebido');
CREATE POLICY "Users see own tickets, admins see company tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND (profile_id = public.get_current_profile_id() OR public.is_admin()));
CREATE POLICY "Admins update company tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

-- 8. Reactions for direct and private-group messages (sector messages keep message_reactions)
CREATE TABLE IF NOT EXISTS public.chat_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  chat_kind text NOT NULL CHECK (chat_kind IN ('dm','group')),
  message_id uuid NOT NULL,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, profile_id, emoji)
);
CREATE INDEX IF NOT EXISTS chat_reactions_message_idx ON public.chat_reactions (message_id);
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_chat_message(_kind text, _message_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _kind
    WHEN 'dm' THEN EXISTS (
      SELECT 1 FROM public.direct_messages d
      WHERE d.id = _message_id AND d.company_id = public.current_company_id()
        AND (d.sender_id = public.get_current_profile_id() OR d.receiver_id = public.get_current_profile_id()))
    WHEN 'group' THEN EXISTS (
      SELECT 1 FROM public.private_group_messages m
      JOIN public.private_groups g ON g.id = m.group_id
      WHERE m.id = _message_id AND g.company_id = public.current_company_id() AND public.is_group_member(m.group_id))
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public.can_access_chat_message(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_chat_message(text, uuid) TO authenticated;

CREATE POLICY "Participants view chat reactions" ON public.chat_reactions FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() AND public.can_access_chat_message(chat_kind, message_id));
CREATE POLICY "Participants add own chat reactions" ON public.chat_reactions FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id()
    AND public.can_access_chat_message(chat_kind, message_id));
CREATE POLICY "Users remove own chat reactions" ON public.chat_reactions FOR DELETE TO authenticated
  USING (profile_id = public.get_current_profile_id());

-- 9. Push devices (Capacitor / FCM tokens)
CREATE TABLE IF NOT EXISTS public.push_devices (
  token text PRIMARY KEY,
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios','web')),
  app_version text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own push devices" ON public.push_devices FOR ALL TO authenticated
  USING (profile_id = public.get_current_profile_id())
  WITH CHECK (profile_id = public.get_current_profile_id() AND company_id = public.current_company_id());

-- 10. Realtime for status changes and the new reactions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;
  END IF;
END $$;
