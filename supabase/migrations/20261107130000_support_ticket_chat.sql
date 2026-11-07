-- Conversation inside a support ticket: the reporter and the support staff
-- (system company) talk in the ticket. Other users never see it.
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id bigint NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_profile_id uuid NOT NULL DEFAULT public.get_current_profile_id() REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name text,
  from_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id, created_at);
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_ticket(_ticket bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_support_staff() OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = _ticket AND t.profile_id = public.get_current_profile_id()
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_ticket(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_ticket(bigint) TO authenticated;

CREATE POLICY "Ticket participants read messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (public.can_access_ticket(ticket_id));
CREATE POLICY "Ticket participants write messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_profile_id = public.get_current_profile_id() AND public.can_access_ticket(ticket_id)
              AND from_staff = public.is_support_staff());

-- Fill the author name and notify the other side.
CREATE OR REPLACE FUNCTION public.on_support_ticket_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.support_tickets;
  target uuid;
BEGIN
  SELECT COALESCE(p.display_name, p.name) INTO NEW.author_name FROM public.profiles p WHERE p.id = NEW.author_profile_id;
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  UPDATE public.support_tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  IF NEW.from_staff THEN
    SELECT user_id INTO target FROM public.profiles WHERE id = t.profile_id;
  ELSE
    SELECT user_id INTO target FROM public.profiles WHERE id = t.assignee_profile_id;
  END IF;
  IF target IS NOT NULL AND target <> auth.uid() THEN
    INSERT INTO public.user_notifications (user_id, type, title, message, is_read)
    VALUES (target, 'support', 'Chamado #EW-' || lpad(t.id::text, 4, '0') || ' · nova mensagem', left(NEW.body, 140), false);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_support_ticket_message ON public.support_ticket_messages;
CREATE TRIGGER on_support_ticket_message BEFORE INSERT ON public.support_ticket_messages FOR EACH ROW EXECUTE FUNCTION public.on_support_ticket_message();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='support_ticket_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
  END IF;
END $$;
