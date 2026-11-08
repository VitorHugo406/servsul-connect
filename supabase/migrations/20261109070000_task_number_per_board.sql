-- Card numbers per board: each board counts its own cards (#1, #2, ...) instead of one
-- sequence for the whole system. Numbers are only displayed (search, reports, mentions show
-- "#N" next to the title); nothing looks a card up by its number.
-- * New card: next number of its board (advisory lock per board = no duplicates on concurrent inserts).
-- * Card moved to another board: gets the next number there.
-- * Cards without a board keep the old global sequence.
-- * Existing cards are renumbered per board in creation order.

CREATE OR REPLACE FUNCTION public.tasks_number_per_board() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.board_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.board_id IS NOT DISTINCT FROM OLD.board_id THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('task_number:' || NEW.board_id::text));
  SELECT coalesce(max(task_number), 0) + 1 INTO NEW.task_number FROM public.tasks WHERE board_id = NEW.board_id AND id <> NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_number_per_board ON public.tasks;
CREATE TRIGGER tasks_number_per_board BEFORE INSERT OR UPDATE OF board_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_number_per_board();

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY board_id ORDER BY created_at, task_number, id) AS n
  FROM public.tasks WHERE board_id IS NOT NULL
)
UPDATE public.tasks t SET task_number = r.n FROM ranked r WHERE r.id = t.id AND t.task_number IS DISTINCT FROM r.n;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_board_task_number_key ON public.tasks (board_id, task_number) WHERE board_id IS NOT NULL;
