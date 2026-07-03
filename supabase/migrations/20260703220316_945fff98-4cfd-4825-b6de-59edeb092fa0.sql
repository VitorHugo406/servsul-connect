
-- ============ 1. Profiles: sensitive fields ============
REVOKE SELECT (phone, address, registration_number, company) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, address, registration_number, company) ON public.profiles FROM anon;
REVOKE UPDATE (phone, address, registration_number, company) ON public.profiles FROM authenticated;
REVOKE UPDATE (phone, address, registration_number, company) ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_full_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.admin_list_profiles_full()
RETURNS SETOF public.profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true)
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles ORDER BY name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profiles_registration(_ids uuid[])
RETURNS TABLE(id uuid, registration_number text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (
    public.is_admin()
    OR public.has_autonomy_level('supervisor')
    OR EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = auth.uid() AND can_access_management = true)
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN QUERY SELECT p.id, p.registration_number FROM public.profiles p WHERE p.id = ANY(_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_sensitive(
  _user_id uuid,
  _phone text,
  _address text,
  _registration_number text,
  _company text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.is_admin() OR _user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.profiles
    SET phone = _phone,
        address = _address,
        registration_number = _registration_number,
        company = _company,
        updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_full_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_profiles_full() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_profiles_registration(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_profile_sensitive(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_full_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles_full() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_profiles_registration(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_profile_sensitive(uuid, text, text, text, text) TO authenticated, service_role;

-- ============ 2. Realtime channel authorization ============
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated can broadcast realtime" ON realtime.messages;

CREATE POLICY "authenticated can read realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated can broadcast realtime"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============ 3. Attachments: verify sector access on messages ============
DROP POLICY IF EXISTS "Users can view attachments in messages they can see" ON public.attachments;
CREATE POLICY "Users can view attachments in messages they can see"
  ON public.attachments FOR SELECT
  USING (
    ((message_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = attachments.message_id
        AND public.user_has_sector_access(auth.uid(), m.sector_id)
    ))
    OR ((direct_message_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = attachments.direct_message_id
        AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
    ))
    OR ((announcement_id IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = attachments.announcement_id
    ))
  );

-- ============ 4. supervisor_team_members: members can see themselves ============
DROP POLICY IF EXISTS "Supervisors can view their team" ON public.supervisor_team_members;
CREATE POLICY "Supervisors and members can view team"
  ON public.supervisor_team_members FOR SELECT
  USING (
    supervisor_id = auth.uid()
    OR member_profile_id = public.get_current_profile_id()
    OR public.is_admin()
  );

-- ============ 5. user_notifications: force through RPC ============
DROP POLICY IF EXISTS "Users can create own notifications" ON public.user_notifications;

CREATE OR REPLACE FUNCTION public.create_user_notification(
  _target_user_id uuid,
  _type text,
  _title text,
  _message text,
  _reference_id uuid DEFAULT NULL::uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_notification_id uuid;
  allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  allowed := _target_user_id = auth.uid() OR public.is_admin();

  IF NOT allowed AND _type = 'war_room' AND _reference_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.war_rooms wr
      WHERE wr.id = _reference_id AND wr.created_by = auth.uid()
    ) INTO allowed;
  END IF;

  IF NOT allowed AND _type = 'mention' THEN
    IF _reference_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.private_group_members actor_member
        JOIN public.profiles actor_profile ON actor_profile.id = actor_member.profile_id
        JOIN public.private_group_members target_member ON target_member.group_id = actor_member.group_id
        WHERE actor_member.group_id = _reference_id
          AND actor_profile.user_id = auth.uid()
          AND target_member.user_id = _target_user_id
      ) INTO allowed;
    END IF;
    IF NOT allowed THEN
      -- Allow chat mention when target is active user
      SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE user_id = _target_user_id AND is_active = true
      ) INTO allowed;
    END IF;
  END IF;

  IF NOT allowed THEN RAISE EXCEPTION 'not allowed'; END IF;

  INSERT INTO public.user_notifications (user_id, type, title, message, reference_id)
  VALUES (_target_user_id, _type, _title, _message, _reference_id)
  RETURNING id INTO new_notification_id;

  RETURN new_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_notification(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, uuid) TO authenticated, service_role;

-- ============ 6. war_rooms membership-scoped SELECT ============
CREATE OR REPLACE FUNCTION public.is_war_room_member(_war_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.war_room_members
    WHERE war_room_id = _war_room_id AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_war_room_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_war_room_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "All authenticated can view war rooms" ON public.war_rooms;
CREATE POLICY "Members creators and admins can view war rooms"
  ON public.war_rooms FOR SELECT
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR public.is_war_room_member(id)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND (up.can_create_war_room = true OR up.can_access_management = true)
    )
  );

DROP POLICY IF EXISTS "All authenticated can view war room members" ON public.war_room_members;
CREATE POLICY "Members creators and admins can view war room members"
  ON public.war_room_members FOR SELECT
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR public.is_war_room_member(war_room_id)
    OR EXISTS (
      SELECT 1 FROM public.war_rooms wr
      WHERE wr.id = war_room_members.war_room_id AND wr.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND (up.can_create_war_room = true OR up.can_access_management = true)
    )
  );

DROP POLICY IF EXISTS "All authenticated can view timeline" ON public.war_room_timeline;
CREATE POLICY "Members creators and admins can view timeline"
  ON public.war_room_timeline FOR SELECT
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR public.is_war_room_member(war_room_id)
    OR EXISTS (
      SELECT 1 FROM public.war_rooms wr
      WHERE wr.id = war_room_timeline.war_room_id AND wr.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = auth.uid()
        AND (up.can_create_war_room = true OR up.can_access_management = true)
    )
  );
