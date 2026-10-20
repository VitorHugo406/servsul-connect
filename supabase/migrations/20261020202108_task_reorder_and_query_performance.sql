-- Atomic task reordering: one database round-trip instead of one UPDATE per card.
CREATE OR REPLACE FUNCTION public.reorder_board_tasks_fast(
  _board_id uuid,
  _updates jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _updated_count integer;
  _requested_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_board_member(_board_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'array' THEN
    RAISE EXCEPTION 'updates must be a JSON array' USING ERRCODE = '22023';
  END IF;

  _requested_count := jsonb_array_length(_updates);
  IF _requested_count = 0 THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_updates) AS u(id uuid, position integer)
    WHERE u.id IS NULL OR u.position IS NULL OR u.position < 0
  ) THEN
    RAISE EXCEPTION 'invalid task reorder payload' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT u.id)
    FROM jsonb_to_recordset(_updates) AS u(id uuid, position integer)
  ) THEN
    RAISE EXCEPTION 'duplicate task IDs in reorder payload' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tasks AS t
  SET position = u.position,
      updated_at = now()
  FROM jsonb_to_recordset(_updates) AS u(id uuid, position integer)
  WHERE t.id = u.id
    AND t.board_id = _board_id
    AND t.company_id = public.current_company_id();

  GET DIAGNOSTICS _updated_count = ROW_COUNT;

  IF _updated_count <> _requested_count THEN
    RAISE EXCEPTION 'one or more tasks do not belong to this board' USING ERRCODE = '42501';
  END IF;

  RETURN _updated_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.reorder_board_tasks_fast(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_board_tasks_fast(uuid, jsonb) TO authenticated, service_role;
