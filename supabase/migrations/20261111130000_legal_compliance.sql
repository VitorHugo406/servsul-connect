-- LGPD / legal: registry of acceptances (Termos, Privacidade, DPA by version) and data-subject requests.

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  user_id uuid NOT NULL,
  company_id uuid,
  doc text NOT NULL CHECK (doc IN ('termos', 'privacidade', 'cookies', 'dpa')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, doc, version)
);
CREATE INDEX IF NOT EXISTS legal_acceptances_company_idx ON public.legal_acceptances (company_id, accepted_at DESC);
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legal_acceptances FROM anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;
DROP POLICY IF EXISTS "Own acceptances" ON public.legal_acceptances;
CREATE POLICY "Own acceptances" ON public.legal_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

-- The DPA is accepted on behalf of the company, so only company admins may register it.
CREATE OR REPLACE FUNCTION public.accept_legal_documents(_version text, _docs text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.get_current_profile_id(); co uuid := public.current_company_id(); d text;
BEGIN
  IF me IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOREACH d IN ARRAY _docs LOOP
    IF d NOT IN ('termos', 'privacidade', 'cookies', 'dpa') THEN RAISE EXCEPTION 'invalid document'; END IF;
    IF d = 'dpa' AND NOT public.is_admin() THEN CONTINUE; END IF;
    INSERT INTO public.legal_acceptances (profile_id, user_id, company_id, doc, version) VALUES (me, auth.uid(), co, d, left(_version, 20))
    ON CONFLICT (profile_id, doc, version) DO NOTHING;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_legal_documents(text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_legal_documents(text, text[]) TO authenticated;

-- Data-subject requests (LGPD art. 18). The person's company admin and the super admin are warned in the Comunicados chat.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  company_id uuid,
  kind text NOT NULL CHECK (kind IN ('access', 'correction', 'deletion', 'portability', 'consent', 'info')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.privacy_requests FROM anon, authenticated;
GRANT SELECT ON public.privacy_requests TO authenticated;
DROP POLICY IF EXISTS "Own or admin reads requests" ON public.privacy_requests;
CREATE POLICY "Own or admin reads requests" ON public.privacy_requests FOR SELECT TO authenticated
  USING (profile_id = public.get_current_profile_id() OR (company_id = public.current_company_id() AND public.is_admin()) OR public.is_super_admin());

CREATE OR REPLACE FUNCTION public.request_privacy_action(_kind text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.get_current_profile_id(); co uuid := public.current_company_id(); rid uuid; who text; adm record; sa record; txt text;
  sys constant uuid := '00000000-0000-0000-0000-0000000000c1'; admin_co constant uuid := '00000000-0000-0000-0000-0000000000a1';
  label text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('access', 'correction', 'deletion', 'portability', 'consent', 'info') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  INSERT INTO public.privacy_requests (profile_id, company_id, kind, note) VALUES (me, co, _kind, left(_note, 1000)) RETURNING id INTO rid;
  SELECT coalesce(nullif(display_name, ''), name) INTO who FROM public.profiles WHERE id = me;
  label := CASE _kind WHEN 'access' THEN 'acesso' WHEN 'correction' THEN 'correção' WHEN 'deletion' THEN 'exclusão' WHEN 'portability' THEN 'portabilidade' WHEN 'consent' THEN 'revogação de consentimento' ELSE 'informações' END;
  txt := '*Pedido de privacidade (LGPD)*' || E'\n\n' || who || ' pediu: ' || label || '.' || coalesce(E'\n\n"' || left(_note, 300) || '"', '') || E'\n\nResponda em até 15 dias.';
  FOR adm IN SELECT id FROM public.profiles WHERE company_id = co AND autonomy_level = 'admin' AND is_active AND id <> me ORDER BY created_at LIMIT 1 LOOP
    INSERT INTO public.direct_messages (sender_id, receiver_id, content, company_id) VALUES (sys, adm.id, txt, co);
  END LOOP;
  FOR sa IN SELECT p.id FROM public.profiles p JOIN public.user_roles r ON r.user_id = p.user_id AND r.role = 'super_admin' WHERE p.company_id = admin_co ORDER BY p.created_at LIMIT 1 LOOP
    INSERT INTO public.direct_messages (sender_id, receiver_id, content, company_id) VALUES (sys, sa.id, txt || E'\n\nEmpresa: ' || coalesce((SELECT name FROM public.companies WHERE id = co), '-'), admin_co);
  END LOOP;
  RETURN rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.request_privacy_action(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_privacy_action(text, text) TO authenticated;

-- A copy of the caller's own data (profile, messages they wrote or received, acceptances, requests).
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.get_current_profile_id(); r jsonb;
BEGIN
  IF me IS NULL OR auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'exportado_em', now(),
    'perfil', (SELECT to_jsonb(p) - 'user_id' FROM public.profiles p WHERE p.id = me),
    'mensagens_diretas', coalesce((SELECT jsonb_agg(jsonb_build_object('enviada_em', m.created_at, 'enviada_por_mim', m.sender_id = me, 'conteudo', m.content) ORDER BY m.created_at)
       FROM public.direct_messages m WHERE m.sender_id = me OR m.receiver_id = me), '[]'::jsonb),
    'mensagens_de_setor', coalesce((SELECT jsonb_agg(jsonb_build_object('enviada_em', m.created_at, 'conteudo', m.content) ORDER BY m.created_at)
       FROM public.messages m WHERE m.author_id = me), '[]'::jsonb),
    'mensagens_de_grupo', coalesce((SELECT jsonb_agg(jsonb_build_object('enviada_em', m.created_at, 'conteudo', m.content) ORDER BY m.created_at)
       FROM public.private_group_messages m WHERE m.sender_id = me), '[]'::jsonb),
    'aceites_legais', coalesce((SELECT jsonb_agg(jsonb_build_object('documento', a.doc, 'versao', a.version, 'aceito_em', a.accepted_at)) FROM public.legal_acceptances a WHERE a.profile_id = me), '[]'::jsonb),
    'pedidos_de_privacidade', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', q.kind, 'situacao', q.status, 'criado_em', q.created_at)) FROM public.privacy_requests q WHERE q.profile_id = me), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
