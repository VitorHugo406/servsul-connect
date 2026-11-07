-- Shared per-conversation settings. First flag: "Tarefas pelo chat" (create and move
-- board tasks from the conversation). Keys: sector:<sector_id>, group:<group_id>,
-- dm:<profile_a>:<profile_b> (profile ids sorted, so both participants share it).
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.current_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
  chat_key text NOT NULL CHECK (chat_key ~ '^(sector:[0-9a-f-]{36}|group:[0-9a-f-]{36}|dm:[0-9a-f-]{36}:[0-9a-f-]{36})$'),
  tasks_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, chat_key)
);
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

-- Who may change a conversation's settings: company admins; group admins for groups;
-- either participant for direct conversations.
CREATE OR REPLACE FUNCTION public.can_manage_chat(_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  kind text := split_part(_key, ':', 1);
  me uuid := public.get_current_profile_id();
BEGIN
  IF me IS NULL THEN RETURN false; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  IF kind = 'group' THEN RETURN public.is_group_admin(split_part(_key, ':', 2)::uuid); END IF;
  IF kind = 'dm' THEN RETURN me::text IN (split_part(_key, ':', 2), split_part(_key, ':', 3)); END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.can_manage_chat(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_chat(text) TO authenticated;

CREATE POLICY "Company users read chat settings" ON public.chat_settings FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Managers insert chat settings" ON public.chat_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_chat(chat_key));
CREATE POLICY "Managers update chat settings" ON public.chat_settings FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.can_manage_chat(chat_key))
  WITH CHECK (company_id = public.current_company_id() AND public.can_manage_chat(chat_key));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='chat_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
  END IF;
END $$;
