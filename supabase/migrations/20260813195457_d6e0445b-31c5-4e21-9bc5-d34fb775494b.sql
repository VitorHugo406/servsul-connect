-- 1. Remove wrong company defaults so the trigger assigns the caller's company
ALTER TABLE public.announcements ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.api_integrations ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.calendar_events ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.direct_messages ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.eval_competencies ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.eval_cycles ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.eval_positions ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.evaluations ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.important_announcements ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.messages ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.notes ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.private_groups ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.scheduled_summaries ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.sectors ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.task_boards ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.tasks ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.teams ALTER COLUMN company_id DROP DEFAULT;
ALTER TABLE public.war_rooms ALTER COLUMN company_id DROP DEFAULT;

-- 2. Ensure the company trigger exists everywhere it is needed
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['api_integrations','eval_competencies','eval_cycles','eval_positions','evaluations','important_announcements','scheduled_summaries'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_company_id_default ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_company_id_default BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_company_id_default()', t);
  END LOOP;
END $$;

-- 3. Move heavy base64 cover images out of tasks
CREATE TABLE IF NOT EXISTS public.task_covers (
  task_id uuid PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  image text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_covers TO authenticated;
GRANT ALL ON public.task_covers TO service_role;

ALTER TABLE public.task_covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view task covers"
ON public.task_covers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_covers.task_id AND t.board_id IS NOT NULL AND public.is_board_member(t.board_id)));

CREATE POLICY "Board members can manage task covers"
ON public.task_covers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_covers.task_id AND t.board_id IS NOT NULL AND public.is_board_member(t.board_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_covers.task_id AND t.board_id IS NOT NULL AND public.is_board_member(t.board_id)));

CREATE TRIGGER update_task_covers_updated_at
BEFORE UPDATE ON public.task_covers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS has_cover boolean NOT NULL DEFAULT false;

INSERT INTO public.task_covers (task_id, image)
SELECT id, cover_image FROM public.tasks
WHERE cover_image LIKE 'data:%'
ON CONFLICT (task_id) DO NOTHING;

UPDATE public.tasks SET has_cover = true, cover_image = NULL WHERE cover_image LIKE 'data:%';

-- 4. Fast board task list without heavy columns
DROP FUNCTION IF EXISTS public.get_board_tasks_fast(uuid);

CREATE OR REPLACE FUNCTION public.get_board_tasks_fast(_board_id uuid)
RETURNS TABLE (
  id uuid, task_number integer, title text, description text, status text, priority text,
  assigned_to uuid, created_by uuid, sector_id uuid, board_id uuid, cover_image text,
  has_cover boolean, due_date timestamptz, "position" integer, is_archived boolean,
  is_template boolean, completed_at timestamptz, completed_late boolean, delay_days integer,
  is_emergency boolean, created_at timestamptz, updated_at timestamptz, assignee jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.task_number, t.title, t.description, t.status, t.priority,
    t.assigned_to, t.created_by, t.sector_id, t.board_id,
    CASE WHEN t.cover_image LIKE 'data:%' THEN NULL ELSE t.cover_image END AS cover_image,
    COALESCE(t.has_cover, false) AS has_cover,
    t.due_date, t."position",
    COALESCE(t.is_archived, false) AS is_archived,
    COALESCE(t.is_template, false) AS is_template,
    t.completed_at, t.completed_late, t.delay_days,
    COALESCE(t.is_emergency, false) AS is_emergency,
    t.created_at, t.updated_at,
    CASE WHEN p.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', p.id, 'name', p.name, 'display_name', p.display_name, 'avatar_url', p.avatar_url)
    END AS assignee
  FROM public.tasks t
  LEFT JOIN public.profiles p ON p.id = t.assigned_to
  WHERE t.board_id = _board_id
    AND public.is_board_member(_board_id)
  ORDER BY t."position" ASC;
$$;

-- 5. Fetch a single task cover on demand
CREATE OR REPLACE FUNCTION public.get_task_cover(_task_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.image
  FROM public.task_covers c
  JOIN public.tasks t ON t.id = c.task_id
  WHERE c.task_id = _task_id
    AND t.board_id IS NOT NULL
    AND public.is_board_member(t.board_id);
$$;

REVOKE ALL ON FUNCTION public.get_task_cover(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_task_cover(uuid) TO authenticated;
