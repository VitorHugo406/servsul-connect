-- 10 days before the end of the 1st (45 days) and 2nd (90 days) experience period, the collaborator's manager(s) get a
-- notice in the Comunicados chat. Dates come from the encrypted employee record (admission date, or the contract dates).
CREATE TABLE IF NOT EXISTS public.experience_notices (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period smallint NOT NULL CHECK (period IN (1, 2)),
  end_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, period, end_date)
);
ALTER TABLE public.experience_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.experience_notices FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_experience_notices() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  r record; d jsonb; start_d date; end_d date; per int; left_days int; mgr uuid; sent int := 0; managers uuid[]; owner_email text; label text; nm text; body text;
  iso text := '^\d{4}-\d{2}-\d{2}$';
BEGIN
  FOR r IN
    SELECT er.profile_id, er.company_id, er.data_enc, p.name, p.display_name, p.user_id
    FROM public.employee_records er
    JOIN public.profiles p ON p.id = er.profile_id
    JOIN public.companies c ON c.id = er.company_id
    WHERE p.is_active AND NOT c.is_system AND NOT coalesce(c.is_suspended, false)
  LOOP
    BEGIN
      d := pgp_sym_decrypt(r.data_enc, public.employee_data_key())::jsonb;
    EXCEPTION WHEN others THEN CONTINUE; END;
    start_d := CASE WHEN coalesce(d->>'contract_start', d->>'admission_date') ~ iso THEN coalesce(d->>'contract_start', d->>'admission_date')::date END;
    IF start_d IS NULL THEN CONTINUE; END IF;
    FOR per IN 1..2 LOOP
      end_d := CASE per
        WHEN 1 THEN CASE WHEN d->>'contract_end_1' ~ iso THEN (d->>'contract_end_1')::date ELSE start_d + 44 END
        ELSE CASE WHEN d->>'contract_end_2' ~ iso THEN (d->>'contract_end_2')::date ELSE start_d + 89 END END;
      left_days := end_d - today;
      CONTINUE WHEN left_days < 0 OR left_days > 10;
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.experience_notices n WHERE n.profile_id = r.profile_id AND n.period = per AND n.end_date = end_d);
      -- managers: "Minha equipe" supervisors and supervisors of teams that contain the person
      SELECT array_agg(DISTINCT m.id) INTO managers FROM (
        SELECT pm.id FROM public.supervisor_team_members s JOIN public.profiles pm ON pm.user_id = s.supervisor_id
          WHERE s.member_profile_id = r.profile_id AND pm.company_id = r.company_id AND pm.is_active
        UNION
        SELECT pm.id FROM public.team_members tm JOIN public.teams t ON t.id = tm.team_id JOIN public.profiles pm ON pm.user_id = t.supervisor_id
          WHERE tm.profile_id = r.profile_id AND pm.company_id = r.company_id AND pm.is_active
      ) m WHERE m.id <> r.profile_id;
      IF managers IS NULL THEN   -- nobody manages this person: the company's base admin gets it
        SELECT pa.id INTO mgr FROM public.profiles pa WHERE pa.company_id = r.company_id AND pa.is_active AND lower(pa.email) = public.company_owner_email(r.company_id) LIMIT 1;
        IF mgr IS NULL THEN CONTINUE; END IF;
        managers := ARRAY[mgr];
      END IF;
      nm := coalesce(nullif(r.display_name, ''), r.name);
      label := CASE per WHEN 1 THEN '1ª experiência (45 dias)' ELSE '2ª experiência (90 dias)' END;
      body := format(E'*%s: faltam %s dia(s) para o fim da %s*\n\nO período termina em %s. %s',
        nm, left_days, CASE per WHEN 1 THEN 'primeira experiência' ELSE 'segunda experiência' END, to_char(end_d, 'DD/MM/YYYY'),
        CASE per WHEN 1 THEN 'Faça a avaliação de 45 dias em Avaliações > Nova avaliação, antes do prazo.' ELSE 'Faça a avaliação de 90 dias em Avaliações > Nova avaliação e decida sobre a efetivação, antes do prazo.' END);
      FOREACH mgr IN ARRAY managers LOOP
        INSERT INTO public.direct_messages (sender_id, receiver_id, content, company_id) VALUES (public.system_sender_id(), mgr, body, r.company_id);
        sent := sent + 1;
      END LOOP;
      INSERT INTO public.experience_notices (profile_id, period, end_date) VALUES (r.profile_id, per, end_d);
    END LOOP;
  END LOOP;
  RETURN sent;
END $$;
REVOKE ALL ON FUNCTION public.send_experience_notices() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('ewvon-experience-notices') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-experience-notices');
SELECT cron.schedule('ewvon-experience-notices', '0 11 * * *', $$SELECT public.send_experience_notices()$$);
