
-- Fix: Add explicit DELETE policy for board members on columns
CREATE POLICY "Board members can delete columns"
ON public.task_board_columns
FOR DELETE
USING (is_board_member(board_id));

-- Labels system
CREATE TABLE public.task_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_label_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.task_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, label_id)
);

ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_label_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view labels"
ON public.task_labels FOR SELECT
USING (is_board_member(board_id));

CREATE POLICY "Board members can create labels"
ON public.task_labels FOR INSERT
WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update labels"
ON public.task_labels FOR UPDATE
USING (is_board_member(board_id));

CREATE POLICY "Board members can delete labels"
ON public.task_labels FOR DELETE
USING (is_board_member(board_id));

CREATE POLICY "Board members can view label assignments"
ON public.task_label_assignments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
));

CREATE POLICY "Board members can assign labels"
ON public.task_label_assignments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
));

CREATE POLICY "Board members can remove label assignments"
ON public.task_label_assignments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_id AND t.board_id IS NOT NULL AND is_board_member(t.board_id)
));

-- Also fix: allow board members to delete their own tasks or board owner to delete any
DROP POLICY IF EXISTS "Board members can delete board tasks" ON public.tasks;
CREATE POLICY "Board members can delete board tasks"
ON public.tasks FOR DELETE
USING (
  board_id IS NOT NULL AND is_board_member(board_id)
);
