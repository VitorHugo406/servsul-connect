-- A manual status change in the middle of a meeting is respected: the system does not change it again until that meeting ends.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_skip_until timestamptz;

CREATE OR REPLACE FUNCTION public.profiles_status_manual() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF new.user_status IS DISTINCT FROM old.user_status AND coalesce(current_setting('app.status_sync', true), '') <> 'on' THEN
    new.status_auto := NULL;
    new.status_skip_until := (
      SELECT max(b.ends_at) FROM public.meeting_bookings b
       WHERE b.company_id = new.company_id AND b.starts_at <= now() AND b.ends_at > now()
         AND (b.booked_by = new.id OR EXISTS (SELECT 1 FROM public.meeting_booking_participants x WHERE x.booking_id = b.id AND x.profile_id = new.id)));
  END IF;
  RETURN new;
END $$;

CREATE OR REPLACE FUNCTION public.sync_meeting_status() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.status_sync', 'on', true);
  UPDATE public.profiles p SET user_status = 'meeting', status_auto = 'meeting'
   WHERE p.is_active IS NOT FALSE AND coalesce(p.user_status, 'available') = 'available'
     AND (p.status_skip_until IS NULL OR p.status_skip_until <= now())
     AND EXISTS (
       SELECT 1 FROM public.meeting_bookings b
        WHERE b.company_id = p.company_id AND b.starts_at <= now() AND b.ends_at > now()
          AND (b.booked_by = p.id OR EXISTS (SELECT 1 FROM public.meeting_booking_participants x WHERE x.booking_id = b.id AND x.profile_id = p.id)));
  UPDATE public.profiles p SET user_status = 'available', status_auto = NULL
   WHERE p.status_auto = 'meeting' AND p.user_status = 'meeting'
     AND NOT EXISTS (
       SELECT 1 FROM public.meeting_bookings b
        WHERE b.company_id = p.company_id AND b.starts_at <= now() AND b.ends_at > now()
          AND (b.booked_by = p.id OR EXISTS (SELECT 1 FROM public.meeting_booking_participants x WHERE x.booking_id = b.id AND x.profile_id = p.id)));
  UPDATE public.profiles SET status_auto = NULL WHERE status_auto IS NOT NULL AND user_status IS DISTINCT FROM 'meeting';
END $$;
REVOKE ALL ON FUNCTION public.sync_meeting_status() FROM PUBLIC, anon, authenticated;
