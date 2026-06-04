CREATE OR REPLACE FUNCTION public.can_view_calendar_event(_event_id uuid, _created_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _created_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.meeting_participants mp
      WHERE mp.event_id = _event_id
        AND mp.profile_id = public.get_current_profile_id()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_meeting_participants(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      WHERE ce.id = _event_id
        AND ce.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.meeting_participants mp
      WHERE mp.event_id = _event_id
        AND mp.profile_id = public.get_current_profile_id()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_calendar_event(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_meeting_participants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_calendar_event(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_meeting_participants(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can view calendar events" ON public.calendar_events;
CREATE POLICY "Users can view own or invited calendar events"
ON public.calendar_events
FOR SELECT
TO authenticated
USING (public.can_view_calendar_event(id, created_by));

DROP POLICY IF EXISTS "Users can view meeting participants" ON public.meeting_participants;
CREATE POLICY "Users can view participants for visible events"
ON public.meeting_participants
FOR SELECT
TO authenticated
USING (public.can_view_meeting_participants(event_id));

DROP POLICY IF EXISTS "Users can create task comments" ON public.task_comments;
CREATE POLICY "Board members can create task comments"
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = public.get_current_profile_id()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_comments.task_id
      AND public.is_board_member(t.board_id)
  )
);

CREATE OR REPLACE FUNCTION public.create_user_notification(
  _target_user_id uuid,
  _type text,
  _title text,
  _message text,
  _reference_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_notification_id uuid;
  allowed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  allowed := _target_user_id = auth.uid() OR public.is_admin();

  IF NOT allowed AND _type = 'war_room' AND _reference_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.war_rooms wr
      WHERE wr.id = _reference_id AND wr.created_by = auth.uid()
    ) INTO allowed;
  END IF;

  IF NOT allowed AND _type = 'mention' AND _reference_id IS NOT NULL THEN
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
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.user_notifications (user_id, type, title, message, reference_id)
  VALUES (_target_user_id, _type, _title, _message, _reference_id)
  RETURNING id INTO new_notification_id;

  RETURN new_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_user_notification(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_user_notification(uuid, text, text, text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.user_notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON public.user_notifications;
CREATE POLICY "Users can create own notifications"
ON public.user_notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own workload alerts" ON public.workload_alerts;
CREATE POLICY "Users can view their own workload alerts"
ON public.workload_alerts
FOR SELECT
TO authenticated
USING (profile_id = public.get_current_profile_id());

DROP POLICY IF EXISTS "System can insert history" ON public.api_integration_history;
CREATE POLICY "Managers can create API history entries"
ON public.api_integration_history
FOR INSERT
TO authenticated
WITH CHECK (
  performed_by = auth.uid()
  AND (public.is_admin() OR public.has_autonomy_level('supervisor'))
);

DROP POLICY IF EXISTS "Attachments are publicly accessible for viewing" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view attachment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can view avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE OR REPLACE FUNCTION public.get_board_tasks_fast(_board_id uuid)
RETURNS TABLE (
  id uuid,
  task_number integer,
  title text,
  description text,
  status text,
  priority text,
  assigned_to uuid,
  created_by uuid,
  sector_id uuid,
  board_id uuid,
  cover_image text,
  due_date timestamp with time zone,
  "position" integer,
  is_archived boolean,
  is_template boolean,
  completed_at timestamp with time zone,
  completed_late boolean,
  delay_days integer,
  is_emergency boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  assignee jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.task_number,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.assigned_to,
    t.created_by,
    t.sector_id,
    t.board_id,
    CASE
      WHEN t.cover_image IS NULL THEN NULL
      WHEN t.cover_image LIKE 'data:%' THEN NULL
      WHEN length(t.cover_image) > 2048 THEN NULL
      ELSE t.cover_image
    END AS cover_image,
    t.due_date,
    t."position",
    COALESCE(t.is_archived, false) AS is_archived,
    COALESCE(t.is_template, false) AS is_template,
    t.completed_at,
    t.completed_late,
    t.delay_days,
    COALESCE(t.is_emergency, false) AS is_emergency,
    t.created_at,
    t.updated_at,
    CASE
      WHEN p.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', p.id, 'name', p.name, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
    END AS assignee
  FROM public.tasks t
  LEFT JOIN public.profiles p ON p.id = t.assigned_to
  WHERE t.board_id = _board_id
    AND public.is_board_member(_board_id)
  ORDER BY t."position" ASC;
$$;

REVOKE ALL ON FUNCTION public.get_board_tasks_fast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_board_tasks_fast(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_current_autonomy_level() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_sector_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_is_member_of_group(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_board_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_board_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_profile_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_empty(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_user_is_active() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_last_seen() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_autonomy_level(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_board_admin_or_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_current_sector_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_note(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_note(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_note_shared_with_me(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_note_owner(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_current_autonomy_level() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_sector_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_deletion() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_is_member_of_group(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_board_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_board_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_empty(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_is_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_autonomy_level(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_board_admin_or_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_sector_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_note(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_note(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_note_shared_with_me(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_note_owner(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by_start ON public.calendar_events (created_by, start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON public.calendar_events (start_date);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_profile_event ON public.meeting_participants (profile_id, event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_event_profile ON public.meeting_participants (event_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_author_created ON public.task_comments (task_id, author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_created ON public.user_notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_board_members_user_board ON public.task_board_members (user_id, board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_archived_template_position ON public.tasks (board_id, is_archived, is_template, status, "position");
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_read_created ON public.direct_messages (receiver_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sector_created_at ON public.messages (sector_id, created_at DESC);