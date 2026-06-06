-- Security + performance hardening for task board and integrations

-- 1) API integrations: keep only hashes for API keys, not plaintext keys
ALTER TABLE public.api_integrations
  ADD COLUMN IF NOT EXISTS api_key_hash text;

UPDATE public.api_integrations
SET api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex')
WHERE api_key_hash IS NULL
  AND api_key IS NOT NULL;

ALTER TABLE public.api_integrations
  ALTER COLUMN api_key_hash SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_integrations'
      AND column_name = 'api_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_integrations'
      AND column_name = 'api_key_hint'
  ) THEN
    ALTER TABLE public.api_integrations RENAME COLUMN api_key TO api_key_hint;
  END IF;
END $$;

UPDATE public.api_integrations
SET api_key_hint = 'stored-as-hash'
WHERE api_key_hint IS NULL OR api_key_hint LIKE 'sk\_%' ESCAPE '\';

-- 2) Attachment storage: no broad bucket reads/writes
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachment files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments if they have access to the record" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

CREATE POLICY "Users can upload attachments to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view permitted attachment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.attachments a
      WHERE a.file_url LIKE '%' || storage.objects.name
        AND (
          (a.message_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.messages m WHERE m.id = a.message_id
          ))
          OR (a.direct_message_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.direct_messages dm
            WHERE dm.id = a.direct_message_id
              AND (dm.sender_id = public.get_current_profile_id() OR dm.receiver_id = public.get_current_profile_id())
          ))
          OR (a.announcement_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.announcements an WHERE an.id = a.announcement_id
          ))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.cover_image LIKE '%' || storage.objects.name
        AND public.is_board_member(t.board_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_board_columns c
      WHERE c.auto_cover LIKE '%' || storage.objects.name
        AND public.is_board_member(c.board_id)
    )
  )
);

CREATE POLICY "Users can delete attachments from their own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) Task activities: only trusted function can create entries
DROP POLICY IF EXISTS "Authenticated can insert task activities" ON public.task_activities;
DROP POLICY IF EXISTS "Board members can insert task activities" ON public.task_activities;

CREATE OR REPLACE FUNCTION public.log_task_activity_secure(
  _task_id uuid,
  _action_type text,
  _description text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _board_id uuid;
  _profile_id uuid;
  _user_name text;
  _activity_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT t.board_id INTO _board_id
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF _board_id IS NULL OR NOT public.is_board_member(_board_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT p.id, COALESCE(NULLIF(p.display_name, ''), p.name, 'Usuário')
  INTO _profile_id, _user_name
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  INSERT INTO public.task_activities (task_id, user_id, user_name, action_type, description, metadata)
  VALUES (_task_id, auth.uid(), _user_name, left(_action_type, 50), left(_description, 500), COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _activity_id;

  RETURN _activity_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_task_activity_secure(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_task_activity_secure(uuid, text, text, jsonb) TO authenticated, service_role;

-- 4) Monthly scores: no direct self-forged writes; use validated refresh function
DROP POLICY IF EXISTS "Board members or self insert monthly scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Board members or self update monthly scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Authenticated can insert scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Authenticated can update scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Admins and system can insert scores" ON public.monthly_scores;
DROP POLICY IF EXISTS "Admins and system can update scores" ON public.monthly_scores;

CREATE POLICY "Admins can insert monthly scores"
ON public.monthly_scores
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update monthly scores"
ON public.monthly_scores
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.refresh_board_monthly_scores(_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month text := to_char(now(), 'YYYY-MM');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_board_member(_board_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  INSERT INTO public.monthly_scores (
    profile_id,
    board_id,
    year_month,
    score,
    total_tasks,
    completed_tasks,
    late_tasks,
    on_time_tasks,
    updated_at
  )
  WITH board_members AS (
    SELECT DISTINCT tbm.profile_id
    FROM public.task_board_members tbm
    WHERE tbm.board_id = _board_id
  ), task_assignments AS (
    SELECT t.id, t.assigned_to AS profile_id, t.completed_at, t.due_date
    FROM public.tasks t
    WHERE t.board_id = _board_id
      AND COALESCE(t.is_template, false) = false
      AND COALESCE(t.is_archived, false) = false
      AND t.assigned_to IS NOT NULL
    UNION
    SELECT t.id, ta.profile_id, t.completed_at, t.due_date
    FROM public.tasks t
    JOIN public.task_assignees ta ON ta.task_id = t.id
    WHERE t.board_id = _board_id
      AND COALESCE(t.is_template, false) = false
      AND COALESCE(t.is_archived, false) = false
  ), aggregates AS (
    SELECT
      bm.profile_id,
      COUNT(ta.id)::int AS total_tasks,
      COUNT(ta.id) FILTER (WHERE ta.completed_at IS NOT NULL)::int AS completed_tasks,
      COUNT(ta.id) FILTER (WHERE ta.completed_at IS NOT NULL AND ta.due_date IS NOT NULL AND ta.completed_at > (ta.due_date + interval '24 hours'))::int AS late_tasks
    FROM board_members bm
    LEFT JOIN task_assignments ta ON ta.profile_id = bm.profile_id
    GROUP BY bm.profile_id
  )
  SELECT
    profile_id,
    _board_id,
    _month,
    CASE
      WHEN total_tasks = 0 THEN 0
      ELSE ROUND((((completed_tasks - late_tasks)::numeric * (1000.0 / total_tasks)) + (late_tasks::numeric * (1000.0 / total_tasks) * 0.6)))::int
    END AS score,
    total_tasks,
    completed_tasks,
    late_tasks,
    (completed_tasks - late_tasks)::int AS on_time_tasks,
    now()
  FROM aggregates
  ON CONFLICT (profile_id, board_id, year_month)
  DO UPDATE SET
    score = EXCLUDED.score,
    total_tasks = EXCLUDED.total_tasks,
    completed_tasks = EXCLUDED.completed_tasks,
    late_tasks = EXCLUDED.late_tasks,
    on_time_tasks = EXCLUDED.on_time_tasks,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_board_monthly_scores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_board_monthly_scores(uuid) TO authenticated, service_role;

-- 5) Fast board details: labels, assignees and subtask counts in one RPC
CREATE OR REPLACE FUNCTION public.get_board_task_details_fast(_board_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_board_member(_board_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT jsonb_build_object(
    'labels', COALESCE((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.name)
      FROM public.task_labels l
      WHERE l.board_id = _board_id
    ), '[]'::jsonb),
    'label_assignments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', la.id, 'task_id', la.task_id, 'label_id', la.label_id, 'created_at', la.created_at))
      FROM public.task_label_assignments la
      JOIN public.task_labels l ON l.id = la.label_id
      WHERE l.board_id = _board_id
    ), '[]'::jsonb),
    'assignees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ta.id,
        'task_id', ta.task_id,
        'profile_id', ta.profile_id,
        'profile', jsonb_build_object('id', p.id, 'name', p.name, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
      ))
      FROM public.task_assignees ta
      JOIN public.tasks t ON t.id = ta.task_id
      LEFT JOIN public.profiles p ON p.id = ta.profile_id
      WHERE t.board_id = _board_id
    ), '[]'::jsonb),
    'subtask_counts', COALESCE((
      SELECT jsonb_object_agg(task_id, jsonb_build_object('completed', completed, 'total', total))
      FROM (
        SELECT st.task_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE st.is_completed)::int AS completed
        FROM public.task_subtasks st
        JOIN public.tasks t ON t.id = st.task_id
        WHERE t.board_id = _board_id
        GROUP BY st.task_id
      ) s
    ), '{}'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_board_task_details_fast(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_board_task_details_fast(uuid) TO authenticated, service_role;

-- 6) Helpful indexes for these RPCs and storage lookup
CREATE INDEX IF NOT EXISTS idx_api_integrations_api_key_hash ON public.api_integrations(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_attachments_file_url ON public.attachments(file_url);
CREATE INDEX IF NOT EXISTS idx_task_activities_user_created ON public.task_activities(user_id, created_at DESC);

-- 7) Limit direct execution exposure to the functions intentionally called by the client.
-- Helper SECURITY DEFINER functions remain callable where RLS policies depend on them.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_deletion() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_last_seen() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_deletion() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_last_seen() TO service_role;