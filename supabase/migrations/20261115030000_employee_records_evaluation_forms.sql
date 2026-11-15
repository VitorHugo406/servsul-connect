-- Employee data (encrypted), evaluation forms (experience 45/90 days, development), manager-only creation,
-- document validation and short birthday share links.

-- ---------------------------------------------------------------------------------------------
-- 1. Encrypted employee record (salary, admission date, documents...). No direct table access:
--    only the SECURITY DEFINER functions below read/write it (key lives in Vault, never in the app).
-- ---------------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.employee_records (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  data_enc bytea NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.employee_records FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'employee_data_key') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'employee_data_key', 'Key that encrypts employee_records');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.employee_data_key() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, vault AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'employee_data_key' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.employee_data_key() FROM PUBLIC, anon, authenticated;

-- Team rule: the caller supervises a team that contains this person (same company).
CREATE OR REPLACE FUNCTION public.is_team_manager_of(_profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    JOIN public.profiles p ON p.id = tm.profile_id
    WHERE tm.profile_id = _profile AND t.supervisor_id = auth.uid()
      AND t.company_id = p.company_id AND public.same_company(t.company_id)
      AND p.id <> public.get_current_profile_id()
  )
$$;
REVOKE ALL ON FUNCTION public.is_team_manager_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_manager_of(uuid) TO authenticated;

-- Admin only writes; unknown keys are dropped. Values are merged with what is already stored.
CREATE OR REPLACE FUNCTION public.set_employee_record(_profile uuid, _data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid; cur jsonb := '{}'::jsonb; clean jsonb := '{}'::jsonb; k text; allowed text[] := ARRAY['admission_date','job_title','salary','rg','cpf','pis','ctps','contract_start','contract_end_1','contract_end_2','registration','manager_name','notes'];
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _profile;
  IF cid IS NULL OR NOT public.same_company(cid) OR NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão para alterar os dados do funcionário.'; END IF;
  FOR k IN SELECT jsonb_object_keys(coalesce(_data, '{}'::jsonb)) LOOP
    IF k = ANY (allowed) AND length(coalesce(_data->>k, '')) <= 200 THEN clean := clean || jsonb_build_object(k, _data->k); END IF;
  END LOOP;
  SELECT pgp_sym_decrypt(data_enc, public.employee_data_key())::jsonb INTO cur FROM public.employee_records WHERE profile_id = _profile;
  cur := coalesce(cur, '{}'::jsonb) || clean;
  -- empty strings remove the field
  FOR k IN SELECT jsonb_object_keys(cur) LOOP IF cur->>k = '' THEN cur := cur - k; END IF; END LOOP;
  INSERT INTO public.employee_records (profile_id, company_id, data_enc, updated_by, updated_at)
  VALUES (_profile, cid, pgp_sym_encrypt(cur::text, public.employee_data_key()), auth.uid(), now())
  ON CONFLICT (profile_id) DO UPDATE SET data_enc = excluded.data_enc, updated_by = excluded.updated_by, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.set_employee_record(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_employee_record(uuid, jsonb) TO authenticated;

-- Admin reads everything; the team manager (and the person) read only the non-financial fields used in the forms.
CREATE OR REPLACE FUNCTION public.get_employee_record(_profile uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid; d jsonb; full_access boolean; limited boolean;
BEGIN
  SELECT company_id INTO cid FROM public.profiles WHERE id = _profile;
  IF cid IS NULL OR NOT public.same_company(cid) THEN RETURN '{}'::jsonb; END IF;
  full_access := public.is_admin();
  limited := public.is_team_manager_of(_profile) OR _profile = public.get_current_profile_id();
  IF NOT full_access AND NOT limited THEN RETURN '{}'::jsonb; END IF;
  SELECT pgp_sym_decrypt(data_enc, public.employee_data_key())::jsonb INTO d FROM public.employee_records WHERE profile_id = _profile;
  d := coalesce(d, '{}'::jsonb);
  IF NOT full_access THEN d := d - 'salary' - 'rg' - 'cpf' - 'pis' - 'ctps' - 'notes'; END IF;
  RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.get_employee_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_record(uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Evaluation forms
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS phase integer,
  ADD COLUMN IF NOT EXISTS doc_number integer,
  ADD COLUMN IF NOT EXISTS doc_key text,
  ADD COLUMN IF NOT EXISTS prev_evaluation_id uuid REFERENCES public.evaluations(id) ON DELETE SET NULL;
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_kind_check;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_kind_check CHECK (kind IN ('general', 'experience', 'development'));
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_phase_check;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_phase_check CHECK (phase IS NULL OR phase IN (45, 90));

CREATE OR REPLACE FUNCTION public.evaluation_doc_defaults() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  IF new.doc_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('evaluation-doc:' || coalesce(new.company_id::text, '')));
    SELECT coalesce(max(doc_number), 0) + 1 INTO new.doc_number FROM public.evaluations WHERE company_id IS NOT DISTINCT FROM new.company_id;
  END IF;
  IF new.doc_key IS NULL THEN
    h := upper(encode(digest(new.id::text || coalesce(new.company_id::text, '') || new.doc_number::text || gen_random_uuid()::text, 'sha256'), 'hex'));
    new.doc_key := substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4);
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS evaluations_doc_defaults ON public.evaluations;
CREATE TRIGGER evaluations_doc_defaults BEFORE INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.evaluation_doc_defaults();

-- Existing rows get a number and a key too.
DO $$ BEGIN
  WITH n AS (SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY created_at, id) AS rn FROM public.evaluations WHERE doc_number IS NULL)
  UPDATE public.evaluations e SET doc_number = coalesce((SELECT max(x.doc_number) FROM public.evaluations x WHERE x.company_id IS NOT DISTINCT FROM e.company_id), 0) + n.rn FROM n WHERE e.id = n.id;
  UPDATE public.evaluations SET doc_key = (SELECT substr(hh, 1, 4) || '-' || substr(hh, 5, 4) || '-' || substr(hh, 9, 4) FROM (SELECT upper(encode(digest(evaluations.id::text || gen_random_uuid()::text, 'sha256'), 'hex')) AS hh) q) WHERE doc_key IS NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_doc_key_uidx ON public.evaluations (doc_key);
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_company_doc_number_uidx ON public.evaluations (company_id, doc_number);

-- Only the manager of the person's team creates the evaluation; only the evaluator (or an admin) changes it.
DROP POLICY IF EXISTS "Evaluators can create evaluations" ON public.evaluations;
CREATE POLICY "Evaluators can create evaluations" ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (same_company(company_id) AND evaluator_id = get_current_profile_id() AND evaluated_id <> get_current_profile_id() AND public.is_team_manager_of(evaluated_id));
DROP POLICY IF EXISTS "Evaluators can update evaluations" ON public.evaluations;
CREATE POLICY "Evaluators can update evaluations" ON public.evaluations FOR UPDATE TO authenticated
  USING (same_company(company_id) AND (evaluator_id = get_current_profile_id() OR is_admin()))
  WITH CHECK (same_company(company_id) AND (evaluator_id = get_current_profile_id() OR is_admin()));
DROP POLICY IF EXISTS "Users can view own evaluations" ON public.evaluations;
CREATE POLICY "Users can view own evaluations" ON public.evaluations FOR SELECT TO authenticated
  USING (same_company(company_id) AND (evaluator_id = get_current_profile_id() OR is_admin() OR (evaluated_id = get_current_profile_id() AND status <> 'draft')));
DROP POLICY IF EXISTS "Evaluators can manage items" ON public.evaluation_items;
CREATE POLICY "Evaluators can manage items" ON public.evaluation_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND same_company(e.company_id) AND (e.evaluator_id = get_current_profile_id() OR is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND same_company(e.company_id) AND (e.evaluator_id = get_current_profile_id() OR is_admin())));
DROP POLICY IF EXISTS "Users can view evaluation items" ON public.evaluation_items;
CREATE POLICY "Users can view evaluation items" ON public.evaluation_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.evaluations e WHERE e.id = evaluation_items.evaluation_id AND same_company(e.company_id) AND (e.evaluator_id = get_current_profile_id() OR is_admin() OR (e.evaluated_id = get_current_profile_id() AND e.status <> 'draft'))));

-- People the caller may evaluate (their teams' members). Drives the "Nova avaliação" list.
CREATE OR REPLACE FUNCTION public.my_team_people() RETURNS TABLE (profile_id uuid, name text, sector_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, coalesce(nullif(p.display_name, ''), p.name), s.name
  FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id
  JOIN public.profiles p ON p.id = tm.profile_id
  LEFT JOIN public.sectors s ON s.id = p.sector_id
  WHERE t.supervisor_id = auth.uid() AND public.same_company(t.company_id) AND p.company_id = t.company_id
    AND p.is_active AND p.id <> public.get_current_profile_id()
$$;
REVOKE ALL ON FUNCTION public.my_team_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_people() TO authenticated;

-- Public document check (QR code): confirms authenticity without exposing personal data.
CREATE OR REPLACE FUNCTION public.validate_evaluation_doc(_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT jsonb_build_object('valid', true, 'company', c.name, 'number', e.doc_number, 'kind', e.kind, 'phase', e.phase,
                              'issued_at', e.created_at, 'status', e.status, 'version', coalesce(e.version, 1))
    FROM public.evaluations e JOIN public.companies c ON c.id = e.company_id
    WHERE e.doc_key = upper(trim(_key)) LIMIT 1
  ), jsonb_build_object('valid', false))
$$;
REVOKE ALL ON FUNCTION public.validate_evaluation_doc(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_evaluation_doc(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Short birthday share links (the QR code stays small and easy to read)
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.birthday_shares (
  id text PRIMARY KEY,
  company_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.birthday_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.birthday_shares FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_birthday_share(_payload jsonb, _expires timestamptz) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cid uuid := public.current_company_id(); sid text;
BEGIN
  IF cid IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF jsonb_typeof(_payload) <> 'object' OR length(_payload::text) > 200000 THEN RAISE EXCEPTION 'Dados inválidos.'; END IF;
  sid := substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=', 'xyz'), 1, 10);
  INSERT INTO public.birthday_shares (id, company_id, payload, created_by, expires_at) VALUES (sid, cid, _payload, auth.uid(), least(coalesce(_expires, now() + interval '45 days'), now() + interval '60 days'));
  DELETE FROM public.birthday_shares WHERE expires_at < now() - interval '7 days';
  RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.create_birthday_share(jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_birthday_share(jsonb, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_birthday_share(_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT payload FROM public.birthday_shares WHERE id = _id AND expires_at > now()
$$;
REVOKE ALL ON FUNCTION public.get_birthday_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_birthday_share(text) TO anon, authenticated;
