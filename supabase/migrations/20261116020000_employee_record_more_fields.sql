-- Gerenciamento: ficha completa do colaborador (dados pessoais, contato, endereço, jornada, banco).
-- Continua tudo criptografado em employee_records; só administradores gravam. Gestores e a própria pessoa
-- só leem os campos NÃO sensíveis (documentos, salário, dados bancários e contato pessoal ficam só com o administrador).
CREATE OR REPLACE FUNCTION public.set_employee_record(_profile uuid, _data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid; cur jsonb := '{}'::jsonb; clean jsonb := '{}'::jsonb; k text;
  allowed text[] := ARRAY['admission_date','job_title','salary','rg','cpf','pis','ctps','contract_start','contract_end_1','contract_end_2','registration','manager_name','notes',
    'social_name','marital_status','education','rg_issuer','sex','phone_alt','personal_email','emergency_name','emergency_relation','emergency_phone',
    'zip','street','number','complement','district','city','state','unit','contract_type','work_start','work_end','break_time','weekly_hours','work_days',
    'bank','agency','account','account_type','pix_type','pix_key','force_pw_change'];
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _profile;
  IF cid IS NULL OR NOT public.same_company(cid) OR NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão para alterar os dados do funcionário.'; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(_data, '{}'::jsonb)) LOOP
    IF k = ANY (allowed) AND length(coalesce(_data->>k, '')) <= 200 THEN clean := clean || jsonb_build_object(k, _data->k); END IF;
  END LOOP;
  SELECT pgp_sym_decrypt(data_enc, public.employee_data_key())::jsonb INTO cur FROM public.employee_records WHERE profile_id = _profile;
  cur := coalesce(cur, '{}'::jsonb) || clean;
  FOR k IN SELECT jsonb_object_keys(cur) LOOP IF cur->>k = '' THEN cur := cur - k; END IF; END LOOP;
  INSERT INTO public.employee_records (profile_id, company_id, data_enc, updated_by, updated_at)
  VALUES (_profile, cid, pgp_sym_encrypt(cur::text, public.employee_data_key()), auth.uid(), now())
  ON CONFLICT (profile_id) DO UPDATE SET data_enc = excluded.data_enc, updated_by = excluded.updated_by, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.set_employee_record(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employee_record(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_employee_record(_profile uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid; d jsonb; full_access boolean; limited boolean; k text;
  secret text[] := ARRAY['salary','rg','cpf','pis','ctps','notes','rg_issuer','marital_status','education','sex','phone_alt','personal_email','emergency_name','emergency_relation','emergency_phone',
    'zip','street','number','complement','district','city','state','bank','agency','account','account_type','pix_type','pix_key','force_pw_change'];
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _profile;
  IF cid IS NULL OR NOT public.same_company(cid) THEN RETURN '{}'::jsonb; END IF;
  full_access := public.is_admin();
  limited := public.is_team_manager_of(_profile) OR _profile = public.get_current_profile_id();
  IF NOT full_access AND NOT limited THEN RETURN '{}'::jsonb; END IF;
  SELECT pgp_sym_decrypt(data_enc, public.employee_data_key())::jsonb INTO d FROM public.employee_records WHERE profile_id = _profile;
  d := coalesce(d, '{}'::jsonb);
  IF NOT full_access THEN FOREACH k IN ARRAY secret LOOP d := d - k; END LOOP; END IF;
  RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.get_employee_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_record(uuid) TO authenticated;
