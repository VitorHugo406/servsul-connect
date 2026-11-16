-- War Room: the phones of every convened person ring like an incoming call until they press "Ciente".
-- Native app: an event of kind "call" (CallRinger: default ringtone in loop + vibration, 62 s each) is written to native_events
-- (the trigger native_events_fcm forwards it to Firebase, so it rings even with the app closed). A cron job renews the ring
-- every minute while the person has not acknowledged (max 30 min); acknowledging or closing the room stops it.
CREATE OR REPLACE FUNCTION public.war_room_ring_member(_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.war_room_members%ROWTYPE; r public.war_rooms%ROWTYPE; n bigint := floor(extract(epoch FROM now()) / 60);
BEGIN
  SELECT * INTO m FROM public.war_room_members WHERE id = _member;
  IF NOT FOUND OR m.has_acknowledged THEN RETURN; END IF;
  SELECT * INTO r FROM public.war_rooms WHERE id = m.war_room_id;
  IF NOT FOUND OR r.status <> 'active' OR r.created_by = m.user_id THEN RETURN; END IF;
  INSERT INTO public.native_events (profile_id, payload) VALUES (m.profile_id, jsonb_build_object(
    'kind', 'call', 'callId', 'wr-' || m.id || '-' || n, 'title', '🚨 War Room ativada', 'audio', true,
    'body', left(r.title, 80) || ' — abra o app e dê o ciente', 'url', '/', 'at', (extract(epoch FROM now()) * 1000)::bigint));
END $$;
REVOKE ALL ON FUNCTION public.war_room_ring_member(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.war_room_ring_stop(_member uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.war_room_members%ROWTYPE; n bigint := floor(extract(epoch FROM now()) / 60); k int;
BEGIN
  SELECT * INTO m FROM public.war_room_members WHERE id = _member;
  IF NOT FOUND THEN RETURN; END IF;
  FOR k IN 0..2 LOOP
    INSERT INTO public.native_events (profile_id, payload) VALUES (m.profile_id, jsonb_build_object('kind', 'call-end', 'callId', 'wr-' || m.id || '-' || (n - k), 'at', (extract(epoch FROM now()) * 1000)::bigint));
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.war_room_ring_stop(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.war_room_members_ring() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.has_acknowledged THEN PERFORM public.war_room_ring_member(NEW.id); END IF;
  ELSIF NEW.has_acknowledged AND NOT OLD.has_acknowledged THEN
    PERFORM public.war_room_ring_stop(NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_members_ring() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_members_ring_ins ON public.war_room_members;
CREATE TRIGGER war_room_members_ring_ins AFTER INSERT ON public.war_room_members FOR EACH ROW EXECUTE FUNCTION public.war_room_members_ring();
DROP TRIGGER IF EXISTS war_room_members_ring_upd ON public.war_room_members;
CREATE TRIGGER war_room_members_ring_upd AFTER UPDATE OF has_acknowledged ON public.war_room_members FOR EACH ROW EXECUTE FUNCTION public.war_room_members_ring();

-- closing the room silences everybody who had not answered yet
CREATE OR REPLACE FUNCTION public.war_room_closed_ring() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  IF NEW.status <> 'active' AND OLD.status = 'active' THEN
    FOR m IN SELECT id FROM public.war_room_members WHERE war_room_id = NEW.id AND NOT has_acknowledged LOOP PERFORM public.war_room_ring_stop(m); END LOOP;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.war_room_closed_ring() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS war_room_closed_ring ON public.war_rooms;
CREATE TRIGGER war_room_closed_ring AFTER UPDATE OF status ON public.war_rooms FOR EACH ROW EXECUTE FUNCTION public.war_room_closed_ring();

-- renews the ring every minute for whoever has not pressed "Ciente" (up to 30 minutes after the room opened)
CREATE OR REPLACE FUNCTION public.war_room_ring_tick() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m uuid;
BEGIN
  FOR m IN
    SELECT wm.id FROM public.war_room_members wm JOIN public.war_rooms wr ON wr.id = wm.war_room_id
    WHERE NOT wm.has_acknowledged AND wr.status = 'active' AND wr.created_at > now() - interval '30 minutes'
      AND wm.user_id <> wr.created_by AND wm.joined_at < now() - interval '45 seconds'
  LOOP PERFORM public.war_room_ring_member(m); END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.war_room_ring_tick() FROM PUBLIC, anon, authenticated;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ewvon-war-room-ring';
SELECT cron.schedule('ewvon-war-room-ring', '* * * * *', $cron$SELECT public.war_room_ring_tick()$cron$);
