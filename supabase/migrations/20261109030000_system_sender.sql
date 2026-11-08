-- "Comunicados": one system sender for every company. Automations (daily summaries in groups
-- and sectors, group welcome messages) and the monthly feedback DM are sent by it instead of the
-- company's main admin. People only receive from it: nobody can send messages to it.
--
-- It is a real profile (messages reference profiles) backed by a login that can never be used:
-- random bcrypt password nobody knows and banned forever. It lives in the system (Admin) company,
-- inactive and with profile_type = 'system' so it never shows up in people lists.

DO $$
DECLARE
  uid constant uuid := '00000000-0000-0000-0000-00000000c0c0';
  pid constant uuid := '00000000-0000-0000-0000-0000000000c1';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = uid) THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'comunicados@ewvon.system',
      extensions.crypt(gen_random_uuid()::text || gen_random_uuid()::text, extensions.gen_salt('bf')), now(), 'infinity',
      '{"provider":"email","providers":["email"],"system_sender":true}', '{"name":"Comunicados","display_name":"Comunicados"}',
      now(), now(), false, '', '', '', '');
  END IF;
  -- handle_new_user() created a profile for this login; give it the fixed id and system identity.
  UPDATE public.profiles SET id = pid WHERE user_id = uid AND id <> pid;
  UPDATE public.profiles SET name = 'Comunicados', display_name = 'Comunicados', profile_type = 'system', is_active = false,
    autonomy_level = 'colaborador', avatar_url = 'https://ewvon.vercel.app/ewwon/img/comunicados.png',
    description = 'Comunicados automáticos do ewvon: resumos, boas-vindas e feedback mensal.',
    company_id = '00000000-0000-0000-0000-0000000000a1'
  WHERE id = pid;
END $$;

CREATE OR REPLACE FUNCTION public.system_sender_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS
$$ SELECT '00000000-0000-0000-0000-0000000000c1'::uuid $$;

-- Everyone can see the sender's name/photo (only this one profile; its e-mail is a placeholder).
DROP POLICY IF EXISTS "Everyone views the system sender" ON public.profiles;
CREATE POLICY "Everyone views the system sender" ON public.profiles FOR SELECT TO authenticated
  USING (id = public.system_sender_id());

-- Nobody sends anything to it (restrictive: applies on top of the existing insert policies).
DROP POLICY IF EXISTS "Nobody writes to the system sender" ON public.direct_messages;
CREATE POLICY "Nobody writes to the system sender" ON public.direct_messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (receiver_id <> public.system_sender_id());

-- Group welcome message, now sent by "Comunicados". Only a group admin of the caller's company,
-- for someone who is a member of that group, and only when the group's welcome automation is on.
CREATE OR REPLACE FUNCTION public.post_group_welcome(_group_id uuid, _profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.private_groups; who text;
BEGIN
  SELECT * INTO g FROM public.private_groups WHERE id = _group_id;
  IF g.id IS NULL OR g.company_id <> public.current_company_id() THEN RAISE EXCEPTION 'Grupo não encontrado' USING ERRCODE = '42501'; END IF;
  IF NOT (public.is_group_admin(_group_id) OR public.is_admin()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF coalesce((g.automations->>'welcome')::boolean, true) = false THEN RETURN; END IF;
  SELECT split_part(coalesce(nullif(p.display_name, ''), p.name), ' ', 1) INTO who
    FROM public.private_group_members m JOIN public.profiles p ON p.id = m.profile_id
    WHERE m.group_id = _group_id AND m.profile_id = _profile_id;
  IF who IS NULL THEN RAISE EXCEPTION 'Pessoa não é membro do grupo'; END IF;
  INSERT INTO public.private_group_messages (group_id, sender_id, content)
  VALUES (_group_id, public.system_sender_id(), 'Boas-vindas, ' || who || '! 👋');
END $$;
REVOKE ALL ON FUNCTION public.post_group_welcome(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.post_group_welcome(uuid, uuid) TO authenticated;

-- Only the super admin may edit it (company admins of the Admin company cannot rename/reactivate it).
DROP POLICY IF EXISTS "Only super admin edits the system sender" ON public.profiles;
CREATE POLICY "Only super admin edits the system sender" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id <> public.system_sender_id() OR public.is_super_admin());
