-- Support desk for the master (system) company: its users see every ticket from
-- every company, take ownership ("quem está atendendo") and change the status.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_name text;

-- Users of the system company ("Admin") or super admins.
CREATE OR REPLACE FUNCTION public.is_support_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.companies c ON c.id = p.company_id
      WHERE p.user_id = auth.uid() AND p.is_active = true AND c.is_system = true
    )
  )
$$;
REVOKE ALL ON FUNCTION public.is_support_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_support_staff() TO authenticated;

DROP POLICY IF EXISTS "Support staff see all tickets" ON public.support_tickets;
CREATE POLICY "Support staff see all tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_support_staff());

-- Full ticket list with company and reporter identity (profiles of other companies are not readable directly).
CREATE OR REPLACE FUNCTION public.support_list_tickets()
RETURNS TABLE (
  id bigint, company_id uuid, company_name text, reporter_id uuid, reporter_name text, reporter_email text,
  category text, area text, severity text, description text, screenshot_path text, device jsonb, status text,
  assignee_profile_id uuid, assignee_name text, created_at timestamptz, updated_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT t.id, t.company_id, c.name, t.profile_id, COALESCE(p.display_name, p.name), p.email,
           t.category, t.area, t.severity, t.description, t.screenshot_path, t.device, t.status,
           t.assignee_profile_id, t.assignee_name, t.created_at, t.updated_at
    FROM public.support_tickets t
    LEFT JOIN public.companies c ON c.id = t.company_id
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    ORDER BY t.created_at DESC
    LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.support_list_tickets() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.support_list_tickets() TO authenticated;

-- Change status and/or take the ticket; notifies the reporter.
CREATE OR REPLACE FUNCTION public.support_update_ticket(_id bigint, _status text, _take boolean DEFAULT false)
RETURNS public.support_tickets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me public.profiles;
  t public.support_tickets;
  reporter_user uuid;
BEGIN
  IF NOT public.is_support_staff() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF _status IS NOT NULL AND _status NOT IN ('Recebido','Em análise','Resolvido','Fechado') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  SELECT * INTO me FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  UPDATE public.support_tickets s SET
    status = COALESCE(_status, s.status),
    assignee_profile_id = CASE WHEN _take THEN me.id ELSE s.assignee_profile_id END,
    assignee_name = CASE WHEN _take THEN COALESCE(me.display_name, me.name) ELSE s.assignee_name END,
    updated_at = now()
  WHERE s.id = _id
  RETURNING * INTO t;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'ticket not found';
  END IF;
  SELECT user_id INTO reporter_user FROM public.profiles WHERE id = t.profile_id;
  IF reporter_user IS NOT NULL AND reporter_user <> auth.uid() THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, reference_id, is_read)
    VALUES (reporter_user, 'support', 'Chamado #EW-' || lpad(t.id::text, 4, '0') || ': ' || t.status,
            COALESCE('Atendido por ' || t.assignee_name, 'Seu chamado foi atualizado.'), NULL, false);
  END IF;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.support_update_ticket(bigint, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.support_update_ticket(bigint, text, boolean) TO authenticated;

-- Support staff can open ticket screenshots stored under <uid>/support/ in the attachments bucket.
DROP POLICY IF EXISTS "Support staff read ticket screenshots" ON storage.objects;
CREATE POLICY "Support staff read ticket screenshots" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND (storage.foldername(name))[2] = 'support' AND public.is_support_staff());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_tickets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
END $$;
