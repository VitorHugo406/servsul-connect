-- Super admin: permanently delete a company and EVERYTHING that belongs to it
-- (people and their logins, sectors, chats, tasks, notices, evaluations, rooms, etc.).
-- Safeguards: only the system super admin, never the system (Admin) company, the exact
-- company name must be typed, and it all runs in one transaction (any failure = nothing deleted).
CREATE OR REPLACE FUNCTION public.super_admin_delete_company(_company_id uuid, _confirm_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  c public.companies;
  uids uuid[];
  pids uuid[];
  t text;
  pass int;
  remaining int;
  n bigint;
  total bigint := 0;
  people int;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Apenas o super administrador pode excluir empresas' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.companies WHERE id = _company_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  IF c.is_system THEN RAISE EXCEPTION 'A empresa do sistema (Admin) não pode ser excluída'; END IF;
  IF btrim(coalesce(_confirm_name, '')) <> btrim(c.name) THEN RAISE EXCEPTION 'Digite exatamente o nome da empresa para confirmar'; END IF;

  SELECT array_agg(user_id), array_agg(id) INTO uids, pids FROM public.profiles WHERE company_id = _company_id;
  uids := coalesce(uids, '{}'); pids := coalesce(pids, '{}');
  people := cardinality(pids);
  -- The caller must never delete their own account this way.
  IF auth.uid() = ANY (uids) THEN RAISE EXCEPTION 'Você não pode excluir a empresa da sua própria conta'; END IF;

  -- Rows that point to the company's people without a company_id of their own.
  DELETE FROM public.private_group_messages WHERE sender_id = ANY (pids);
  DELETE FROM public.task_comments WHERE author_id = ANY (pids);
  DELETE FROM public.board_join_requests WHERE profile_id = ANY (pids);

  -- Every table with company_id; repeat passes so dependent tables go first.
  FOR pass IN 1..8 LOOP
    remaining := 0;
    FOR t IN SELECT cl.table_name FROM information_schema.columns cl
             JOIN information_schema.tables tb ON tb.table_schema = cl.table_schema AND tb.table_name = cl.table_name AND tb.table_type = 'BASE TABLE'
             WHERE cl.table_schema = 'public' AND cl.column_name = 'company_id' AND cl.table_name <> 'companies'
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', t) USING _company_id;
        GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
      EXCEPTION WHEN foreign_key_violation THEN
        remaining := remaining + 1;
      END;
    END LOOP;
    EXIT WHEN remaining = 0;
  END LOOP;
  IF remaining > 0 THEN RAISE EXCEPTION 'Não foi possível apagar todos os dados ligados à empresa (dependências restantes)'; END IF;

  -- Per-user rows, then the logins themselves.
  DELETE FROM public.user_roles WHERE user_id = ANY (uids);
  DELETE FROM public.user_permissions WHERE user_id = ANY (uids);
  DELETE FROM auth.users WHERE id = ANY (uids);
  DELETE FROM public.companies WHERE id = _company_id;

  RETURN jsonb_build_object('company', c.name, 'people', people, 'rows', total);
END $$;
REVOKE ALL ON FUNCTION public.super_admin_delete_company(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_delete_company(uuid, text) TO authenticated;
