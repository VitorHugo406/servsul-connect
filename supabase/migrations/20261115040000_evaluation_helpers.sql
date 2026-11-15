-- Evaluation form helpers: standard criteria per company (created on demand) and the previous 45-day scores.
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS form_type text;
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_form_type_check;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_form_type_check CHECK (form_type IS NULL OR form_type IN ('exp45','exp90','expExtra','devSemestral','devAnual','devPos','devExtra'));

CREATE OR REPLACE FUNCTION public.ensure_eval_competencies(_category text, _items jsonb) RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := public.current_company_id(); it jsonb;
BEGIN
  IF _category NOT IN ('experience', 'development') THEN RAISE EXCEPTION 'Categoria inválida.'; END IF;
  IF cid IS NULL OR NOT (public.is_admin() OR EXISTS (SELECT 1 FROM public.my_team_people())) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.eval_competencies (name, description, category, is_active, created_by, company_id)
    SELECT left(it->>'name', 120), left(it->>'description', 300), _category, true, auth.uid(), cid
    WHERE NOT EXISTS (SELECT 1 FROM public.eval_competencies c WHERE c.company_id = cid AND c.category = _category AND c.name = left(it->>'name', 120));
  END LOOP;
  RETURN QUERY SELECT c.id, c.name FROM public.eval_competencies c
    WHERE c.company_id = cid AND c.category = _category AND c.name IN (SELECT left(x->>'name', 120) FROM jsonb_array_elements(_items) x);
END $$;
REVOKE ALL ON FUNCTION public.ensure_eval_competencies(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_eval_competencies(text, jsonb) TO authenticated;

-- Latest sent 45-day evaluation of the person (scores by criterion), for the 90-day comparison.
CREATE OR REPLACE FUNCTION public.previous_experience_scores(_evaluated uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  IF NOT (public.is_admin() OR public.is_team_manager_of(_evaluated)) THEN RETURN NULL; END IF;
  SELECT * INTO e FROM public.evaluations ev
    WHERE ev.evaluated_id = _evaluated AND ev.form_type = 'exp45' AND ev.status <> 'draft' AND public.same_company(ev.company_id)
    ORDER BY ev.created_at DESC LIMIT 1;
  IF e.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('evaluation_id', e.id, 'average', e.overall_score, 'date', coalesce(e.sent_at, e.created_at),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', c.name, 'score', i.score)) FROM public.evaluation_items i JOIN public.eval_competencies c ON c.id = i.competency_id WHERE i.evaluation_id = e.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.previous_experience_scores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.previous_experience_scores(uuid) TO authenticated;
