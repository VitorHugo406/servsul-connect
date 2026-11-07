-- Closed support tickets: the reporter rates the service (1-5 + comment) and the
-- conversation is read-only.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS rating smallint CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment text CHECK (char_length(rating_comment) <= 1000),
  ADD COLUMN IF NOT EXISTS rated_at timestamptz;

CREATE OR REPLACE FUNCTION public.ticket_is_closed(_ticket bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT status IN ('Resolvido', 'Fechado') FROM public.support_tickets WHERE id = _ticket), false)
$$;
REVOKE ALL ON FUNCTION public.ticket_is_closed(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ticket_is_closed(bigint) TO authenticated;

DROP POLICY IF EXISTS "Ticket participants write messages" ON public.support_ticket_messages;
CREATE POLICY "Ticket participants write messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_profile_id = public.get_current_profile_id() AND public.can_access_ticket(ticket_id)
              AND from_staff = public.is_support_staff() AND NOT public.ticket_is_closed(ticket_id));

-- Status + rating of one ticket, for the reporter or support staff.
CREATE OR REPLACE FUNCTION public.support_ticket_info(_id bigint)
RETURNS TABLE(status text, rating smallint, rating_comment text, rated_at timestamptz, assignee_name text, is_reporter boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_ticket(_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT t.status, t.rating, t.rating_comment, t.rated_at, t.assignee_name, t.profile_id = public.get_current_profile_id()
    FROM public.support_tickets t WHERE t.id = _id;
END $$;
REVOKE ALL ON FUNCTION public.support_ticket_info(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.support_ticket_info(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_rate_ticket(_id bigint, _rating int, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets; target uuid;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = _id FOR UPDATE;
  IF t.id IS NULL OR t.profile_id IS DISTINCT FROM public.get_current_profile_id() THEN
    RAISE EXCEPTION 'Chamado não encontrado' USING ERRCODE = '42501';
  END IF;
  IF t.status NOT IN ('Resolvido', 'Fechado') THEN RAISE EXCEPTION 'O chamado ainda não foi encerrado'; END IF;
  IF t.rating IS NOT NULL THEN RAISE EXCEPTION 'Você já avaliou este atendimento'; END IF;
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'Escolha de 1 a 5 estrelas'; END IF;
  UPDATE public.support_tickets SET rating = _rating, rating_comment = NULLIF(btrim(left(COALESCE(_comment, ''), 1000)), ''), rated_at = now()
  WHERE id = _id;
  SELECT user_id INTO target FROM public.profiles WHERE id = t.assignee_profile_id;
  IF target IS NOT NULL THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, is_read)
    VALUES (target, 'support', 'Chamado #EW-' || lpad(t.id::text, 4, '0') || ' avaliado', repeat('★', _rating) || repeat('☆', 5 - _rating), false);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.support_rate_ticket(bigint, int, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.support_rate_ticket(bigint, int, text) TO authenticated;

-- Staff desk shows the rating too.
DROP FUNCTION IF EXISTS public.support_list_tickets();
CREATE FUNCTION public.support_list_tickets()
RETURNS TABLE(id bigint, company_id uuid, company_name text, reporter_id uuid, reporter_name text, reporter_email text, category text, area text, severity text, description text, screenshot_path text, device jsonb, status text, assignee_profile_id uuid, assignee_name text, created_at timestamptz, updated_at timestamptz, rating smallint, rating_comment text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.id, t.company_id, c.name, t.profile_id, COALESCE(p.display_name, p.name), p.email,
           t.category, t.area, t.severity, t.description, t.screenshot_path, t.device, t.status,
           t.assignee_profile_id, t.assignee_name, t.created_at, t.updated_at, t.rating, t.rating_comment
    FROM public.support_tickets t
    LEFT JOIN public.companies c ON c.id = t.company_id
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    ORDER BY t.created_at DESC
    LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.support_list_tickets() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.support_list_tickets() TO authenticated;
