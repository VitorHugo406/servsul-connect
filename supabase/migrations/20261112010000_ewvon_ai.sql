-- ewvon AI: each company connects its own Claude API key (company_integrations, provider 'claude', key encrypted by the
-- ewvon-ai edge function). Anyone can write "@ewvonai ..." in a sector or group chat; a trigger hands the message to the
-- edge function, which answers in the same chat and can create cards (title, description, deadline, priority, subtasks).

DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.company_integrations'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%provider%'
  LOOP EXECUTE format('ALTER TABLE public.company_integrations DROP CONSTRAINT %I', c); END LOOP;
  ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_provider_check CHECK (provider IN ('slack', 'teams', 'whatsapp', 'google', 'claude'));
END $$;

-- "ewvon AI" sender (same idea as "Comunicados"): a real profile with a login that can never be used.
DO $$
DECLARE
  uid constant uuid := '00000000-0000-0000-0000-00000000c0c2';
  pid constant uuid := '00000000-0000-0000-0000-0000000000c2';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ai@ewvon.system',
      extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')), now(), 'infinity',
      '{"provider":"email","providers":["email"],"system_sender":true}', '{"name":"ewvon AI","display_name":"ewvon AI"}',
      now(), now(), false, '', '', '', '');
  END IF;
  UPDATE public.profiles SET id = pid WHERE user_id = uid AND id <> pid;
  UPDATE public.profiles SET name = 'ewvon AI', display_name = 'ewvon AI', profile_type = 'system', is_active = false,
    autonomy_level = 'colaborador', avatar_url = 'https://ewvon.vercel.app/ewwon/img/icon-512.png',
    description = 'Assistente de IA do ewvon (usa a chave de IA da própria empresa).',
    company_id = '00000000-0000-0000-0000-0000000000a1'
  WHERE id = pid;
END $$;

CREATE OR REPLACE FUNCTION public.ai_sender_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS
$$ SELECT '00000000-0000-0000-0000-0000000000c2'::uuid $$;

DROP POLICY IF EXISTS "Everyone views the ewvon AI sender" ON public.profiles;
CREATE POLICY "Everyone views the ewvon AI sender" ON public.profiles FOR SELECT TO authenticated USING (id = public.ai_sender_id());
DROP POLICY IF EXISTS "Only super admin edits the ewvon AI sender" ON public.profiles;
CREATE POLICY "Only super admin edits the ewvon AI sender" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id <> public.ai_sender_id() OR public.is_super_admin());

-- Daily use per person (service role only): keeps a company's Claude bill under control.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  n integer NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, day)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS ai_usage_company_idx ON public.ai_usage (company_id);

-- Atomic "use one" for today; returns false once the person reached the limit.
CREATE OR REPLACE FUNCTION public.ai_use(_profile uuid, _company uuid, _limit integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used integer;
BEGIN
  INSERT INTO public.ai_usage (profile_id, company_id, n) VALUES (_profile, _company, 1)
  ON CONFLICT (profile_id, day) DO UPDATE SET n = public.ai_usage.n + 1 WHERE public.ai_usage.n < _limit
  RETURNING n INTO used;
  RETURN used IS NOT NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.ai_use(uuid, uuid, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_use(uuid, uuid, integer) TO service_role;

-- A message with "@ewvonai" in a sector or group goes to the edge function (only when the company enabled the AI).
CREATE OR REPLACE FUNCTION public.ai_on_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; who uuid;
BEGIN
  IF NEW.content IS NULL OR NEW.content !~* '@ewvon\s?ai' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'messages' THEN cid := NEW.company_id; who := NEW.author_id;
  ELSIF TG_TABLE_NAME = 'private_group_messages' THEN SELECT company_id INTO cid FROM public.private_groups WHERE id = NEW.group_id; who := NEW.sender_id;
  ELSE RETURN NEW; END IF;
  IF who IN (public.ai_sender_id(), public.system_sender_id()) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company_integrations WHERE company_id = cid AND provider = 'claude' AND enabled AND secret_enc IS NOT NULL) THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://scslfueixmuolkmgdslk.supabase.co/functions/v1/ewvon-ai/ask',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-integrations-secret', s.decrypted_secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id)
  ) FROM vault.decrypted_secrets s WHERE s.name = 'integrations_secret';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'ai_on_message: %', SQLERRM;  -- never block sending a message
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.ai_on_message() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS ai_on_message_sector ON public.messages;
CREATE TRIGGER ai_on_message_sector AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.ai_on_message();
DROP TRIGGER IF EXISTS ai_on_message_group ON public.private_group_messages;
CREATE TRIGGER ai_on_message_group AFTER INSERT ON public.private_group_messages FOR EACH ROW EXECUTE FUNCTION public.ai_on_message();
