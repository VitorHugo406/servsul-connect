-- Sala de Reunião: tenant-scoped rooms, bookings and participants.
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

-- Chat messages are immutable for regular authenticated users. UPDATE remains
-- available where existing policies permit read receipts (direct messages).
REVOKE DELETE ON TABLE public.messages, public.direct_messages, public.private_group_messages FROM authenticated, anon;
DROP POLICY IF EXISTS "Senders delete own direct messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete their own sent messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Group admins can delete messages" ON public.private_group_messages;
DROP POLICY IF EXISTS "Company group admins delete group messages" ON public.private_group_messages;
DROP POLICY IF EXISTS "Users can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;
