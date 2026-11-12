-- "Em reunião" automatico: quem tem reuniao marcada agora (organizador ou participante) passa a "Em reuniao"
-- e, quando a reuniao termina, volta para "Disponivel". Uma troca manual de status sempre vence.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_auto text;

-- Quando a pessoa (ou o sistema fora da rotina) muda o status, o marcador automatico sai: o status passa a ser dela.
CREATE OR REPLACE FUNCTION public.profiles_status_manual() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF new.user_status IS DISTINCT FROM old.user_status AND coalesce(current_setting('app.status_sync', true), '') <> 'on' THEN
    new.status_auto := NULL;
  END IF;
  RETURN new;
END $$;
DROP TRIGGER IF EXISTS profiles_status_manual ON public.profiles;
CREATE TRIGGER profiles_status_manual BEFORE UPDATE OF user_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_status_manual();

CREATE OR REPLACE FUNCTION public.sync_meeting_status() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.status_sync', 'on', true);
  -- 1) reuniao acontecendo agora -> "Em reuniao" (so para quem esta Disponivel)
  UPDATE public.profiles p SET user_status = 'meeting', status_auto = 'meeting'
   WHERE p.is_active IS NOT FALSE AND coalesce(p.user_status, 'available') = 'available'
     AND EXISTS (
       SELECT 1 FROM public.meeting_bookings b
        WHERE b.company_id = p.company_id AND b.starts_at <= now() AND b.ends_at > now()
          AND (b.booked_by = p.id OR EXISTS (SELECT 1 FROM public.meeting_booking_participants x WHERE x.booking_id = b.id AND x.profile_id = p.id)));
  -- 2) o status "Em reuniao" foi colocado pelo sistema e a reuniao acabou -> volta para "Disponivel"
  UPDATE public.profiles p SET user_status = 'available', status_auto = NULL
   WHERE p.status_auto = 'meeting' AND p.user_status = 'meeting'
     AND NOT EXISTS (
       SELECT 1 FROM public.meeting_bookings b
        WHERE b.company_id = p.company_id AND b.starts_at <= now() AND b.ends_at > now()
          AND (b.booked_by = p.id OR EXISTS (SELECT 1 FROM public.meeting_booking_participants x WHERE x.booking_id = b.id AND x.profile_id = p.id)));
  -- 3) a pessoa trocou o status sozinha: o marcador automatico sai
  UPDATE public.profiles SET status_auto = NULL WHERE status_auto IS NOT NULL AND user_status IS DISTINCT FROM 'meeting';
END $$;
REVOKE ALL ON FUNCTION public.sync_meeting_status() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('ewvon-meeting-status') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ewvon-meeting-status');
SELECT cron.schedule('ewvon-meeting-status', '* * * * *', $cron$SELECT public.sync_meeting_status()$cron$);
