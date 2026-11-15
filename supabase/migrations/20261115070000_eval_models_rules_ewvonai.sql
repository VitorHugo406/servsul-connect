-- Evaluation criteria models (experience: only the company admin edits it), one-time experience rules, EwvonAI name.
ALTER TABLE public.eval_competencies ADD COLUMN IF NOT EXISTS group_name text, ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- The experience model is registered only by the company admin; development criteria also by supervisors.
DROP POLICY IF EXISTS "Supervisors can manage competencies" ON public.eval_competencies;
CREATE POLICY "Admins manage competencies" ON public.eval_competencies FOR ALL TO authenticated
  USING (same_company(company_id) AND is_admin())
  WITH CHECK (same_company(company_id) AND is_admin());
CREATE POLICY "Supervisors manage non-experience competencies" ON public.eval_competencies FOR ALL TO authenticated
  USING (same_company(company_id) AND category <> 'experience' AND has_autonomy_level('supervisor'))
  WITH CHECK (same_company(company_id) AND category <> 'experience' AND has_autonomy_level('supervisor'));

DROP FUNCTION IF EXISTS public.ensure_eval_competencies(text, jsonb);
-- Criteria of a model; created from the standard form the first time (when the company has none yet).
CREATE OR REPLACE FUNCTION public.eval_model(_category text, _seed jsonb, _all boolean DEFAULT false)
RETURNS TABLE (id uuid, name text, description text, group_name text, sort_order integer, is_active boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := public.current_company_id(); it jsonb; i int := 0;
BEGIN
  IF _category NOT IN ('experience', 'development') THEN RAISE EXCEPTION 'Modelo inválido.'; END IF;
  IF cid IS NULL OR NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.my_team_people())) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.eval_competencies c WHERE c.company_id = cid AND c.category = _category) THEN
    FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_seed, '[]'::jsonb)) LOOP
      i := i + 1;
      INSERT INTO public.eval_competencies (name, description, category, group_name, sort_order, is_active, created_by, company_id)
      VALUES (left(it->>'name', 120), left(it->>'description', 300), _category, left(it->>'group', 80), i, true, auth.uid(), cid);
    END LOOP;
  END IF;
  RETURN QUERY SELECT c.id, c.name, c.description, c.group_name, c.sort_order, c.is_active FROM public.eval_competencies c
    WHERE c.company_id = cid AND c.category = _category AND (_all OR c.is_active) ORDER BY c.sort_order, c.created_at;
END $$;
REVOKE ALL ON FUNCTION public.eval_model(text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eval_model(text, jsonb, boolean) TO authenticated;

-- What was already created for a person (the manager cannot read other managers' evaluations through RLS).
CREATE OR REPLACE FUNCTION public.person_eval_forms(_evaluated uuid) RETURNS TABLE (form_type text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.form_type, e.status FROM public.evaluations e
  WHERE e.evaluated_id = _evaluated AND e.form_type IS NOT NULL AND public.same_company(e.company_id)
    AND (public.is_admin() OR public.is_team_manager_of(_evaluated))
$$;
REVOKE ALL ON FUNCTION public.person_eval_forms(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_eval_forms(uuid) TO authenticated;

-- Experience evaluations happen once: one 45-day, one 90-day; after the 90-day only development evaluations.
CREATE OR REPLACE FUNCTION public.evaluation_experience_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.form_type IN ('exp45', 'exp90', 'expExtra') THEN
    IF EXISTS (SELECT 1 FROM public.evaluations e WHERE e.evaluated_id = NEW.evaluated_id AND e.form_type = 'exp90') THEN
      RAISE EXCEPTION 'A avaliação de 90 dias desta pessoa já foi criada: agora só podem ser feitas as avaliações de desenvolvimento (pós-experiência).';
    END IF;
    IF NEW.form_type IN ('exp45', 'exp90') AND EXISTS (SELECT 1 FROM public.evaluations e WHERE e.evaluated_id = NEW.evaluated_id AND e.form_type = NEW.form_type) THEN
      RAISE EXCEPTION 'A avaliação de % dias desta pessoa já foi criada.', CASE NEW.form_type WHEN 'exp45' THEN 45 ELSE 90 END;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS evaluations_experience_rules ON public.evaluations;
CREATE TRIGGER evaluations_experience_rules BEFORE INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.evaluation_experience_rules();

-- EwvonAI: name and the animated orb (the app recognizes this avatar file and draws the orb).
UPDATE public.profiles SET name = 'EwvonAI', display_name = 'EwvonAI', avatar_url = 'https://ewvon.vercel.app/ewwon/img/ewvonai.png' WHERE id = '00000000-0000-0000-0000-0000000000c2';
