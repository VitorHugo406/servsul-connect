
-- Table to store card auto-duplication schedules
CREATE TABLE public.task_auto_duplications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.task_boards(id) ON DELETE CASCADE,
  target_column_id UUID NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  last_duplicated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_auto_duplications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Board members can view duplications"
  ON public.task_auto_duplications FOR SELECT
  USING (is_board_member(board_id));

CREATE POLICY "Board members can create duplications"
  ON public.task_auto_duplications FOR INSERT
  WITH CHECK (is_board_member(board_id));

CREATE POLICY "Board members can update duplications"
  ON public.task_auto_duplications FOR UPDATE
  USING (is_board_member(board_id));

CREATE POLICY "Board members can delete duplications"
  ON public.task_auto_duplications FOR DELETE
  USING (is_board_member(board_id));
