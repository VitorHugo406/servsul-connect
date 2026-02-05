
-- Create subtasks table for individual card checklists
CREATE TABLE public.task_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view subtasks"
  ON public.task_subtasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND public.is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can insert subtasks"
  ON public.task_subtasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND public.is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can update subtasks"
  ON public.task_subtasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND public.is_board_member(t.board_id)
  ));

CREATE POLICY "Board members can delete subtasks"
  ON public.task_subtasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_subtasks.task_id
    AND public.is_board_member(t.board_id)
  ));
