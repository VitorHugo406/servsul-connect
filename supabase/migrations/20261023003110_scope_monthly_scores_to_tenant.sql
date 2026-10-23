-- Restrict monthly score aggregation to a single, validated tenant and board.
CREATE OR REPLACE FUNCTION public.refresh_board_monthly_scores(_board_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _month text := to_char(now(), 'YYYY-MM');
  _company_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT b.company_id INTO _company_id
  FROM public.task_boards b
  WHERE b.id = _board_id AND b.company_id = public.current_company_id()
    AND public.is_board_member(b.id);

  IF _company_id IS NULL THEN RAISE EXCEPTION 'not allowed'; END IF;

  INSERT INTO public.monthly_scores (
    profile_id, board_id, year_month, score, total_tasks,
    completed_tasks, late_tasks, on_time_tasks, updated_at
  )
  WITH board_members AS (
    SELECT DISTINCT tbm.profile_id
    FROM public.task_board_members tbm
    JOIN public.profiles p ON p.id = tbm.profile_id
      AND p.company_id = _company_id AND p.is_active = true
    WHERE tbm.board_id = _board_id
  ), task_assignments AS (
    SELECT t.id, t.assigned_to AS profile_id, t.completed_at, t.due_date
    FROM public.tasks t
    JOIN public.task_boards b ON b.id = t.board_id AND b.company_id = t.company_id
    JOIN public.profiles p ON p.id = t.assigned_to AND p.company_id = _company_id AND p.is_active = true
    WHERE t.board_id = _board_id AND t.company_id = _company_id
      AND COALESCE(t.is_template, false) = false AND COALESCE(t.is_archived, false) = false
      AND t.assigned_to IS NOT NULL
    UNION
    SELECT t.id, ta.profile_id, t.completed_at, t.due_date
    FROM public.tasks t
    JOIN public.task_boards b ON b.id = t.board_id AND b.company_id = t.company_id
    JOIN public.task_assignees ta ON ta.task_id = t.id
    JOIN public.profiles p ON p.id = ta.profile_id AND p.company_id = _company_id AND p.is_active = true
    WHERE t.board_id = _board_id AND t.company_id = _company_id
      AND COALESCE(t.is_template, false) = false AND COALESCE(t.is_archived, false) = false
  ), aggregates AS (
    SELECT bm.profile_id, COUNT(ta.id)::int AS total_tasks,
      COUNT(ta.id) FILTER (WHERE ta.completed_at IS NOT NULL)::int AS completed_tasks,
      COUNT(ta.id) FILTER (WHERE ta.completed_at IS NOT NULL AND ta.due_date IS NOT NULL
        AND ta.completed_at > (ta.due_date + interval '24 hours'))::int AS late_tasks
    FROM board_members bm LEFT JOIN task_assignments ta ON ta.profile_id = bm.profile_id
    GROUP BY bm.profile_id
  )
  SELECT profile_id, _board_id, _month,
    CASE WHEN total_tasks = 0 THEN 0
      ELSE ROUND((((completed_tasks - late_tasks)::numeric * (1000.0 / total_tasks))
        + (late_tasks::numeric * (1000.0 / total_tasks) * 0.6)))::int END,
    total_tasks, completed_tasks, late_tasks, (completed_tasks - late_tasks)::int, now()
  FROM aggregates
  ON CONFLICT (profile_id, board_id, year_month)
  DO UPDATE SET score = EXCLUDED.score, total_tasks = EXCLUDED.total_tasks,
    completed_tasks = EXCLUDED.completed_tasks, late_tasks = EXCLUDED.late_tasks,
    on_time_tasks = EXCLUDED.on_time_tasks, updated_at = now();
END;
$function$;
