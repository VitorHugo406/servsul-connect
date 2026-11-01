-- Sala de Reunião: tenant-scoped rooms, bookings and participants.
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_access_meeting_rooms boolean NOT NULL DEFAULT false,
  DROP COLUMN IF EXISTS can_delete_messages;

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
  CONSTRAINT meeting_rooms_valid_hours CHECK (opens_at < closes_at)
);

CREATE TABLE IF NOT EXISTS public.meeting_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 160),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  booked_by uuid NOT NULL REFERENCES public.profiles(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_bookings_valid_time CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.meeting_booking_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.meeting_bookings(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_rooms_company ON public.meeting_rooms(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_company_start ON public.meeting_bookings(company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_room_time ON public.meeting_bookings(room_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_meeting_booking_participants_profile ON public.meeting_booking_participants(profile_id, booking_id);

ALTER TABLE public.meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_booking_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Meeting room access for authorized company users" ON public.meeting_rooms;
CREATE POLICY "Meeting room access for authorized company users"
ON public.meeting_rooms FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid() AND up.can_access_meeting_rooms = true
  ))
);

DROP POLICY IF EXISTS "Admins manage meeting rooms" ON public.meeting_rooms;
CREATE POLICY "Admins manage meeting rooms"
ON public.meeting_rooms FOR ALL TO authenticated
USING (company_id = public.current_company_id() AND public.is_admin())
WITH CHECK (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY IF EXISTS "Authorized users view meeting bookings" ON public.meeting_bookings;
CREATE POLICY "Authorized users view meeting bookings"
ON public.meeting_bookings FOR SELECT TO authenticated
USING (
  company_id = public.current_company_id()
  AND (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid() AND up.can_access_meeting_rooms = true
  ))
);

DROP POLICY IF EXISTS "Authorized users create meeting bookings" ON public.meeting_bookings;
CREATE POLICY "Authorized users create meeting bookings"
ON public.meeting_bookings FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND booked_by = public.get_current_profile_id()
  AND (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid() AND up.can_access_meeting_rooms = true
  ))
  AND EXISTS (
    SELECT 1 FROM public.meeting_rooms r
    WHERE r.id = room_id AND r.company_id = meeting_bookings.company_id AND r.is_active = true
  )
);

DROP POLICY IF EXISTS "Authorized users update meeting bookings" ON public.meeting_bookings;
CREATE POLICY "Authorized users update meeting bookings"
ON public.meeting_bookings FOR UPDATE TO authenticated
USING (
  company_id = public.current_company_id()
  AND (booked_by = public.get_current_profile_id() OR public.is_admin())
)
WITH CHECK (
  company_id = public.current_company_id()
  AND (booked_by = public.get_current_profile_id() OR public.is_admin())
);

DROP POLICY IF EXISTS "Admins delete meeting bookings" ON public.meeting_bookings;
CREATE POLICY "Admins delete meeting bookings"
ON public.meeting_bookings FOR DELETE TO authenticated
USING (company_id = public.current_company_id() AND public.is_admin());

DROP POLICY IF EXISTS "Authorized users view meeting participants" ON public.meeting_booking_participants;
CREATE POLICY "Authorized users view meeting participants"
ON public.meeting_booking_participants FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meeting_bookings b
  WHERE b.id = booking_id AND b.company_id = public.current_company_id()
  AND (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = auth.uid() AND up.can_access_meeting_rooms = true
  ))
));

DROP POLICY IF EXISTS "Booking owners manage meeting participants" ON public.meeting_booking_participants;
CREATE POLICY "Booking owners manage meeting participants"
ON public.meeting_booking_participants FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meeting_bookings b
  WHERE b.id = booking_id AND b.company_id = public.current_company_id()
  AND (b.booked_by = public.get_current_profile_id() OR public.is_admin())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meeting_bookings b
  WHERE b.id = booking_id AND b.company_id = public.current_company_id()
  AND (b.booked_by = public.get_current_profile_id() OR public.is_admin())
) AND EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN public.meeting_bookings b ON b.id = booking_id
  WHERE p.id = profile_id AND p.company_id = b.company_id
));


-- Enforce room opening hours, capacity and non-overlapping reservations in the database,
-- so concurrent clients cannot bypass the checks performed by the interface.
CREATE OR REPLACE FUNCTION public.enforce_meeting_booking_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $
DECLARE
  room_record public.meeting_rooms%ROWTYPE;
  conflict_exists boolean;
BEGIN
  SELECT * INTO room_record
  FROM public.meeting_rooms
  WHERE id = NEW.room_id AND company_id = NEW.company_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sala indisponível para esta empresa.';
  END IF;

  IF (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::time < room_record.opens_at
     OR (NEW.ends_at AT TIME ZONE 'America/Sao_Paulo')::time > room_record.closes_at
     OR (NEW.starts_at AT TIME ZONE 'America/Sao_Paulo')::date <> (NEW.ends_at AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'O agendamento está fora do horário de funcionamento da sala.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.meeting_bookings b
    WHERE b.room_id = NEW.room_id
      AND b.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.starts_at < b.ends_at
      AND NEW.ends_at > b.starts_at
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'A sala já possui uma reserva neste intervalo.';
  END IF;

  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_enforce_meeting_booking_rules ON public.meeting_bookings;
CREATE TRIGGER trg_enforce_meeting_booking_rules
BEFORE INSERT OR UPDATE OF room_id, company_id, starts_at, ends_at
ON public.meeting_bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_meeting_booking_rules();

CREATE OR REPLACE FUNCTION public.enforce_meeting_participant_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $
DECLARE
  room_capacity integer;
  current_count integer;
BEGIN
  SELECT r.capacity INTO room_capacity
  FROM public.meeting_rooms r
  JOIN public.meeting_bookings b ON b.room_id = r.id
  WHERE b.id = NEW.booking_id AND b.company_id = r.company_id;

  IF room_capacity IS NULL THEN
    RAISE EXCEPTION 'Agendamento ou sala não encontrado.';
  END IF;

  SELECT count(*) INTO current_count
  FROM public.meeting_booking_participants
  WHERE booking_id = NEW.booking_id;

  IF current_count >= room_capacity THEN
    RAISE EXCEPTION 'A capacidade máxima da sala foi atingida.';
  END IF;

  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_enforce_meeting_participant_capacity ON public.meeting_booking_participants;
CREATE TRIGGER trg_enforce_meeting_participant_capacity
BEFORE INSERT ON public.meeting_booking_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_meeting_participant_capacity();

REVOKE ALL ON FUNCTION public.enforce_meeting_booking_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_meeting_participant_capacity() FROM PUBLIC, anon, authenticated;

-- Enforce immutability even for privileged application paths and cascading deletes.
CREATE OR REPLACE FUNCTION public.prevent_chat_message_deletion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $
BEGIN
  RAISE EXCEPTION 'Exclusão de mensagens está desabilitada. O histórico de comunicação deve ser preservado.';
END;
$;

DROP TRIGGER IF EXISTS trg_prevent_messages_delete ON public.messages;
CREATE TRIGGER trg_prevent_messages_delete
BEFORE DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_deletion();

DROP TRIGGER IF EXISTS trg_prevent_direct_messages_delete ON public.direct_messages;
CREATE TRIGGER trg_prevent_direct_messages_delete
BEFORE DELETE ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_deletion();

DROP TRIGGER IF EXISTS trg_prevent_private_group_messages_delete ON public.private_group_messages;
CREATE TRIGGER trg_prevent_private_group_messages_delete
BEFORE DELETE ON public.private_group_messages
FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_message_deletion();

REVOKE ALL ON FUNCTION public.prevent_chat_message_deletion() FROM PUBLIC, anon, authenticated;

-- Chat messages are immutable for regular authenticated users. UPDATE remains
-- available where existing policies permit read receipts (direct messages).
REVOKE DELETE ON TABLE public.messages, public.direct_messages, public.private_group_messages FROM authenticated, anon;
DROP POLICY IF EXISTS "Senders delete own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Group admins can delete messages" ON public.private_group_messages;
DROP POLICY IF EXISTS "Company group admins delete group messages" ON public.private_group_messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
