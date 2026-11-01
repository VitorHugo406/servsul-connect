-- EWVON: salas de reunião e histórico de mensagens imutável.
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_access_meeting_rooms boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.meeting_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_rooms_hours_check CHECK (opens_at < closes_at)
);

CREATE TABLE IF NOT EXISTS public.meeting_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  booked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_bookings_time_check CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.meeting_booking_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.meeting_bookings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, profile_id)
);

CREATE INDEX IF NOT EXISTS meeting_rooms_company_active_idx ON public.meeting_rooms(company_id, is_active);
CREATE INDEX IF NOT EXISTS meeting_bookings_company_start_idx ON public.meeting_bookings(company_id, starts_at);
CREATE INDEX IF NOT EXISTS meeting_bookings_room_time_idx ON public.meeting_bookings(room_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS meeting_booking_participants_profile_idx ON public.meeting_booking_participants(profile_id, booking_id);

ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_booking_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_rooms_company_read ON public.meeting_rooms;
CREATE POLICY meeting_rooms_company_read ON public.meeting_rooms FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND (public.is_admin() OR EXISTS (
  SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND p.can_access_meeting_rooms
)));
DROP POLICY IF EXISTS meeting_rooms_admin_write ON public.meeting_rooms;
CREATE POLICY meeting_rooms_admin_write ON public.meeting_rooms FOR ALL TO authenticated
USING (company_id = public.current_company_id() AND public.is_admin())
WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY IF EXISTS meeting_bookings_company_read ON public.meeting_bookings;
CREATE POLICY meeting_bookings_company_read ON public.meeting_bookings FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND (public.is_admin() OR EXISTS (
  SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND p.can_access_meeting_rooms
)));
DROP POLICY IF EXISTS meeting_bookings_company_insert ON public.meeting_bookings;
CREATE POLICY meeting_bookings_company_insert ON public.meeting_bookings FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id() AND booked_by = public.get_current_profile_id()
  AND (public.is_admin() OR EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id = auth.uid() AND p.can_access_meeting_rooms))
  AND EXISTS (SELECT 1 FROM public.meeting_rooms r WHERE r.id = room_id AND r.company_id = meeting_bookings.company_id AND r.is_active));
DROP POLICY IF EXISTS meeting_bookings_owner_update ON public.meeting_bookings;
CREATE POLICY meeting_bookings_owner_update ON public.meeting_bookings FOR UPDATE TO authenticated
USING (company_id = public.current_company_id() AND (booked_by = public.get_current_profile_id() OR public.is_admin()))
WITH CHECK (company_id = public.current_company_id() AND (booked_by = public.get_current_profile_id() OR public.is_admin()));
DROP POLICY IF EXISTS meeting_bookings_admin_delete ON public.meeting_bookings;
CREATE POLICY meeting_bookings_admin_delete ON public.meeting_bookings FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY IF EXISTS meeting_participants_company_read ON public.meeting_booking_participants;
CREATE POLICY meeting_participants_company_read ON public.meeting_booking_participants FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.meeting_bookings b WHERE b.id = booking_id AND b.company_id = public.current_company_id()));
DROP POLICY IF EXISTS meeting_participants_booking_write ON public.meeting_booking_participants;
CREATE POLICY meeting_participants_booking_write ON public.meeting_booking_participants FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.meeting_bookings b WHERE b.id = booking_id AND b.company_id = public.current_company_id()
  AND (b.booked_by = public.get_current_profile_id() OR public.is_admin()))
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.company_id = public.current_company_id() AND p.is_active));

CREATE OR REPLACE FUNCTION public.validate_meeting_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE room_row public.meeting_rooms%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.room_id::text));
  SELECT * INTO room_row FROM public.meeting_rooms WHERE id = NEW.room_id AND company_id = NEW.company_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala indisponível para esta empresa'; END IF;
  IF NEW.starts_at <= now() THEN RAISE EXCEPTION 'O agendamento deve ser futuro'; END IF;
  IF (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::time < room_row.opens_at
     OR (NEW.ends_at AT TIME ZONE 'America/Sao_Paulo')::time > room_row.closes_at
     OR (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::date <> (NEW.ends_at AT TIME ZONE 'America/Sao_Paulo')::date
  THEN RAISE EXCEPTION 'Agendamento fora do horário de funcionamento'; END IF;
  IF EXISTS (SELECT 1 FROM public.meeting_bookings b WHERE b.room_id = NEW.room_id AND b.id <> COALESCE(NEW.id, gen_random_uuid())
    AND tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(NEW.starts_at,NEW.ends_at,'[)'))
  THEN RAISE EXCEPTION 'Já existe uma reunião neste horário'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS meeting_booking_validate ON public.meeting_bookings;
CREATE TRIGGER meeting_booking_validate BEFORE INSERT OR UPDATE ON public.meeting_bookings
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_booking();

CREATE OR REPLACE FUNCTION public.validate_meeting_participant_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE max_people integer; current_people integer;
BEGIN
  SELECT r.capacity INTO max_people FROM public.meeting_bookings b JOIN public.meeting_rooms r ON r.id=b.room_id WHERE b.id=NEW.booking_id;
  SELECT count(*) INTO current_people FROM public.meeting_booking_participants WHERE booking_id=NEW.booking_id;
  IF current_people >= max_people THEN RAISE EXCEPTION 'Capacidade máxima da sala excedida'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS meeting_participant_capacity ON public.meeting_booking_participants;
CREATE TRIGGER meeting_participant_capacity BEFORE INSERT ON public.meeting_booking_participants
FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_participant_capacity();

-- Impede exclusão direta de mensagens no banco, inclusive por chamadas via service role.
CREATE OR REPLACE FUNCTION public.prevent_chat_message_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'O histórico de mensagens é permanente e não pode ser excluído.';
END; $$;
DROP TRIGGER IF EXISTS prevent_messages_delete ON public.messages;
CREATE TRIGGER prevent_messages_delete BEFORE DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_delete();
DROP TRIGGER IF EXISTS prevent_direct_messages_delete ON public.direct_messages;
CREATE TRIGGER prevent_direct_messages_delete BEFORE DELETE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_delete();
DROP TRIGGER IF EXISTS prevent_private_group_messages_delete ON public.private_group_messages;
CREATE TRIGGER prevent_private_group_messages_delete BEFORE DELETE ON public.private_group_messages FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_delete();
REVOKE DELETE ON public.messages, public.direct_messages, public.private_group_messages FROM anon, authenticated;

ALTER TABLE public.meeting_rooms REPLICA IDENTITY FULL;
ALTER TABLE public.meeting_bookings REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_rooms;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
